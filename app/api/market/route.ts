import { parseAbiItem } from "viem";
import { dbReady, getPool } from "@/lib/db";
import { BOOK_ABI, BOOK_ADDRESS, BOOK_CONFIGURED, publicClient } from "@/lib/web3";
import { json } from "@/lib/httpx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMPLE_MS = 55_000; // at most one stored point per minute
const MAX_ORDERS = 200; // matches the /api/orders cap

const FILLED_EVENT = parseAbiItem(
  "event OrderFilled(uint256 indexed id, address indexed taker, uint256 shares, uint256 usdcAmount)",
);
const PLACED_EVENT = parseAbiItem(
  "event OrderPlaced(uint256 indexed id, address indexed maker, bool isYes, bool isAsk, uint256 shares, uint256 price, uint64 expiresAt)",
);

type Level = { price: number; shares: number; isYes: boolean; isAsk: boolean };

/** Every resting order, read straight from contract state. No indexer needed. */
async function readBook(): Promise<Level[]> {
  const count = (await publicClient.readContract({
    address: BOOK_ADDRESS,
    abi: BOOK_ABI,
    functionName: "nextOrderId",
  })) as bigint;

  const total = Math.min(Number(count) - 1, MAX_ORDERS);
  if (total < 1) return [];

  const now = Math.floor(Date.now() / 1000);
  const ids = Array.from({ length: total }, (_, i) => BigInt(i + 1));
  const raw = await Promise.all(
    ids.map((id) =>
      publicClient
        .readContract({ address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "orders", args: [id] })
        .catch(() => null),
    ),
  );

  const out: Level[] = [];
  for (const o of raw) {
    if (!o) continue;
    const [, isYes, isAsk, active, expiresAt, shares, price] = o as readonly [
      string,
      boolean,
      boolean,
      boolean,
      bigint,
      bigint,
      bigint,
      bigint,
    ];
    if (!active || Number(expiresAt) <= now || shares === 0n) continue;
    out.push({
      price: Number(price) / 1e18,
      shares: Number(shares) / 1e6,
      isYes,
      isAsk,
    });
  }
  return out;
}

export async function GET() {
  if (!BOOK_CONFIGURED) return json({ configured: false });

  let price = 0.5;
  let liquidity = 0;
  try {
    const levels = await readBook();
    const asks = levels.filter((l) => l.isYes && l.isAsk).sort((a, b) => a.price - b.price);
    const bids = levels.filter((l) => l.isYes && !l.isAsk).sort((a, b) => b.price - a.price);

    const bestAsk = asks[0]?.price;
    const bestBid = bids[0]?.price;
    if (bestAsk !== undefined && bestBid !== undefined) price = (bestAsk + bestBid) / 2;
    else if (bestAsk !== undefined) price = bestAsk;
    else if (bestBid !== undefined) price = bestBid;

    // Everything committed to resting orders, in USDC.
    liquidity = levels.reduce((s, l) => s + l.shares * l.price, 0);
  } catch {
    return json({ configured: true, error: "rpc_unavailable" }, 503);
  }

  // Fills: walk forward in 10-block chunks (Alchemy free tier limit), store each
  // OrderFilled row, then total from the table. One scan powers the volume,
  // the trader count and the trade feed.
  let volume: number | null = null;
  let traders: number | null = null;
  try {
    const pool = (await dbReady()) ? getPool() : null;
    const latest = await publicClient.getBlockNumber();

    let lastBlock = 0n;
    if (pool) {
      await pool.query(`insert into fills (id) values (1) on conflict (id) do nothing`);
      const { rows } = await pool.query(`select last_block from fills where id = 1`);
      lastBlock = BigInt(rows[0]?.last_block ?? 0);
    }

    const floor = latest > 5_000n ? latest - 5_000n : 0n;
    const from = lastBlock > 0n && lastBlock > floor ? lastBlock + 1n : floor;

    const CHUNK = 10n;
    const CONCURRENCY = 8;
    const ranges: [bigint, bigint][] = [];
    for (let b = from; b <= latest; b += CHUNK) {
      ranges.push([b, b + CHUNK - 1n > latest ? latest : b + CHUNK - 1n]);
    }

    const found: [string, number, string, string, string, string][] = [];
    const makers: string[] = [];
    for (let i = 0; i < ranges.length; i += CONCURRENCY) {
      const batch = ranges.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(([f, t]) =>
          publicClient
            .getLogs({
              address: BOOK_ADDRESS,
              events: [FILLED_EVENT, PLACED_EVENT],
              fromBlock: f,
              toBlock: t,
            })
            .catch(() => []),
        ),
      );
      for (const logs of results) {
        for (const log of logs) {
          const args = log.args as {
            id?: bigint;
            taker?: string;
            maker?: string;
            shares?: bigint;
            usdcAmount?: bigint;
          };
          if (args.maker) {
            makers.push(args.maker.toLowerCase());
            continue;
          }
          if (args.taker === undefined || args.id === undefined) continue;
          found.push([
            String(log.blockNumber ?? 0n),
            Number(log.logIndex ?? 0),
            String(args.id),
            args.taker.toLowerCase(),
            (Number(args.shares ?? 0n) / 1e6).toFixed(6),
            (Number(args.usdcAmount ?? 0n) / 1e6).toFixed(6),
          ]);
        }
      }
    }

    if (pool) {
      for (const r of found) {
        await pool
          .query(
            `insert into trades (block, log_index, order_id, taker, shares, usdc)
             values ($1, $2, $3, $4, $5, $6) on conflict (block, log_index) do nothing`,
            r,
          )
          .catch(() => {});
        await pool
          .query(`insert into participants (address) values ($1) on conflict do nothing`, [r[3]])
          .catch(() => {});
      }
      for (const m of makers) {
        await pool
          .query(`insert into participants (address) values ($1) on conflict do nothing`, [m])
          .catch(() => {});
      }
      await pool
        .query(`update fills set last_block = $1, updated_at = now() where id = 1`, [
          latest.toString(),
        ])
        .catch(() => {});

      const vol = await pool
        .query(`select coalesce(sum(usdc), 0)::text as volume from trades`)
        .catch(() => ({ rows: [] as { volume: string }[] }));
      const people = await pool
        .query(`select count(*)::int as n from participants`)
        .catch(() => ({ rows: [] as { n: number }[] }));
      volume = Number(vol.rows[0]?.volume ?? 0);
      traders = Number(people.rows[0]?.n ?? 0);
    } else {
      volume = 0;
      traders = 0;
    }
  } catch {
    volume = null;
    traders = null;
  }

  // Price series, sampled on read.
  let series: { t: number; p: number }[] = [];
  if (await dbReady()) {
    const pool = getPool();
    if (pool) {
      const last = await pool
        .query(`select at from price_points order by at desc limit 1`)
        .catch(() => ({ rows: [] as { at: Date }[] }));
      const lastAt = last.rows[0]?.at ? new Date(last.rows[0].at).getTime() : 0;
      if (Date.now() - lastAt > SAMPLE_MS) {
        await pool.query(`insert into price_points (price) values ($1)`, [price]).catch(() => {});
      }
      const rows = await pool
        .query(`select price, at from price_points order by at asc limit 2000`)
        .catch(() => ({ rows: [] as { price: string; at: Date }[] }));
      series = rows.rows.map((r) => ({ t: new Date(r.at).getTime(), p: Number(r.price) }));
    }
  }

  return json({ configured: true, price, liquidity, volume, traders, series });
}
