import { parseAbiItem } from "viem";
import { dbReady, getPool } from "@/lib/db";
import { BOOK_ABI, BOOK_ADDRESS, BOOK_CONFIGURED, publicClient } from "@/lib/web3";
import { json } from "@/lib/httpx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMPLE_MS = 55_000; // at most one stored point per minute
const MAX_ORDERS = 200; // matches the /api/orders cap
const LOOKBACK = 5_000n; // ~2.8 hours of Base blocks

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

/**
 * Catching up on fills means hundreds of 10-block eth_getLogs calls (Alchemy's
 * free-tier cap). Running that inside a page request made volume and traders take
 * tens of seconds to appear, so it happens in the background: the response always
 * comes from what is already in Postgres and the scan catches up behind it.
 * Guarded so concurrent page loads start one scan, not ten.
 */
let scanning = false;

async function scanFills(): Promise<void> {
  if (scanning) return;
  if (!(await dbReady())) return;
  const pool = getPool();
  if (!pool) return;

  scanning = true;
  try {
    const latest = await publicClient.getBlockNumber();

    await pool.query(`insert into fills (id) values (1) on conflict (id) do nothing`);
    const { rows } = await pool.query(`select last_block from fills where id = 1`);
    const lastBlock = BigInt(rows[0]?.last_block ?? 0);

    const floor = latest > LOOKBACK ? latest - LOOKBACK : 0n;
    const from = lastBlock > 0n && lastBlock > floor ? lastBlock + 1n : floor;
    if (from > latest) return;

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
      .query(`update fills set last_block = $1, updated_at = now() where id = 1`, [latest.toString()])
      .catch(() => {});
  } catch {
    // A failed scan leaves the cursor where it was; the next request retries.
  } finally {
    scanning = false;
  }
}

/** Two aggregates, no RPC. Null only when the database itself is unreachable. */
async function readTotals(): Promise<{ volume: number; traders: number } | null> {
  if (!(await dbReady())) return null;
  const pool = getPool();
  if (!pool) return null;

  const vol = await pool
    .query(`select coalesce(sum(usdc), 0)::text as volume from trades`)
    .catch(() => null);
  const people = await pool.query(`select count(*)::int as n from participants`).catch(() => null);
  if (!vol || !people) return null;

  return { volume: Number(vol.rows[0]?.volume ?? 0), traders: Number(people.rows[0]?.n ?? 0) };
}

export async function GET() {
  if (!BOOK_CONFIGURED) return json({ configured: false });

  let price = 0.5;
  let liquidity = 0;
  try {
    const levels = await readBook();

    // Both outcomes describe the same market, so NO orders have to be mirrored:
    // a NO bid at p is a YES ask at 1-p, and a NO ask at p is a YES bid at 1-p.
    const bidCandidates = [
      ...levels.filter((l) => l.isYes && !l.isAsk).map((l) => l.price),
      ...levels.filter((l) => !l.isYes && l.isAsk).map((l) => 1 - l.price),
    ];
    const askCandidates = [
      ...levels.filter((l) => l.isYes && l.isAsk).map((l) => l.price),
      ...levels.filter((l) => !l.isYes && !l.isAsk).map((l) => 1 - l.price),
    ];

    const bestBid = bidCandidates.length > 0 ? Math.max(...bidCandidates) : undefined;
    const bestAsk = askCandidates.length > 0 ? Math.min(...askCandidates) : undefined;

    if (bestAsk !== undefined && bestBid !== undefined) price = (bestAsk + bestBid) / 2;
    else if (bestAsk !== undefined) price = bestAsk;
    else if (bestBid !== undefined) price = bestBid;

    liquidity = levels.reduce((s, l) => s + l.shares * l.price, 0);
  } catch {
    return json({ configured: true, error: "rpc_unavailable" }, 503);
  }

  // Fire and forget: the response never waits for the blockchain scan.
  void scanFills();

  const totals = await readTotals();

  // Price series, sampled on read from what is already stored.
  let series: { t: number; p: number }[] = [];
  if (await dbReady()) {
    const pool = getPool();
    if (pool) {
      const last = await pool
        .query(`select at from price_points order by at desc limit 1`)
        .catch(() => null);
      const lastAt = last?.rows[0]?.at ? new Date(last.rows[0].at as Date).getTime() : 0;
      if (Date.now() - lastAt > SAMPLE_MS) {
        await pool.query(`insert into price_points (price) values ($1)`, [price]).catch(() => {});
      }
      const rows = await pool
        .query(`select price, at from price_points order by at asc limit 2000`)
        .catch(() => null);
      series = (rows?.rows ?? []).map((r: { price: string; at: Date }) => ({
        t: new Date(r.at).getTime(),
        p: Number(r.price),
      }));
    }
  }

  return json({
    configured: true,
    price,
    liquidity,
    volume: totals ? totals.volume : null,
    traders: totals ? totals.traders : null,
    series,
  });
}
