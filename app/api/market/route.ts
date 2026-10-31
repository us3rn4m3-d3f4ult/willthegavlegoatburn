import { parseAbiItem } from "viem";
import { dbReady, getPool } from "@/lib/db";
import { AMM_ABI, CONFIGURED, MARKET_ADDRESS, publicClient } from "@/lib/web3";
import { json } from "@/lib/httpx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMPLE_MS = 55_000; // at most one stored point per minute

const BOUGHT_EVENT = parseAbiItem(
  "event Bought(address indexed by, bool yes, uint256 usdcIn, uint256 sharesOut)",
);

export async function GET() {
  if (!CONFIGURED) return json({ configured: false });

  let price = 0;
  let liquidity = 0;
  try {
    const [p, y, n] = await Promise.all([
      publicClient.readContract({ address: MARKET_ADDRESS, abi: AMM_ABI, functionName: "yesPrice" }),
      publicClient.readContract({ address: MARKET_ADDRESS, abi: AMM_ABI, functionName: "yesReserve" }),
      publicClient.readContract({ address: MARKET_ADDRESS, abi: AMM_ABI, functionName: "noReserve" }),
    ]);
    price = Number(p as bigint) / 1e18;
    // Pool depth in USDC: half the combined reserves.
    liquidity = (Number(y as bigint) + Number(n as bigint)) / 2 / 1e6;
  } catch {
    return json({ configured: true, error: "rpc_unavailable" }, 503);
  }

  // Volume and traders, scanned forward in 10-block chunks (Alchemy free tier
  // limit) and persisted so each minute only covers new blocks.
  let volume: number | null = null;
  let traders: number | null = null;
  try {
    const pool = await dbReady() ? getPool() : null;
    const latest = await publicClient.getBlockNumber();

    let lastBlock = 0n;
    let sum = 0;
    let seen: string[] = [];

    if (pool) {
      await pool.query(`insert into trade_stats (id) values (1) on conflict (id) do nothing`);
      const { rows } = await pool.query(
        `select last_block, volume::text as volume, traders from trade_stats where id = 1`,
      );
      lastBlock = BigInt(rows[0]?.last_block ?? 0);
      sum = Number(rows[0]?.volume ?? 0);
      seen = (rows[0]?.traders as string[]) ?? [];
    }

    // Never look back further than this on the first run.
    const floor = latest > 5_000n ? latest - 5_000n : 0n;
    let from = lastBlock > 0n && lastBlock > floor ? lastBlock + 1n : floor;

    const CHUNK = 10n;
    const CONCURRENCY = 8;
    const ranges: [bigint, bigint][] = [];
    for (let b = from; b <= latest; b += CHUNK) {
      ranges.push([b, b + CHUNK - 1n > latest ? latest : b + CHUNK - 1n]);
    }

    const set = new Set(seen);
    for (let i = 0; i < ranges.length; i += CONCURRENCY) {
      const batch = ranges.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(([f, t]) =>
          publicClient
            .getLogs({ address: MARKET_ADDRESS, event: BOUGHT_EVENT, fromBlock: f, toBlock: t })
            .catch(() => []),
        ),
      );
      for (const logs of results) {
        for (const log of logs) {
          const args = log.args as { by?: string; usdcIn?: bigint };
          if (args.usdcIn) sum += Number(args.usdcIn) / 1e6;
          if (args.by) set.add(args.by.toLowerCase());
        }
      }
    }

    volume = sum;
    traders = set.size;

    if (pool) {
      await pool
        .query(
          `update trade_stats set last_block = $1, volume = $2, traders = $3::jsonb, updated_at = now()
           where id = 1`,
          [latest.toString(), sum.toString(), JSON.stringify([...set].slice(0, 500))],
        )
        .catch(() => {});
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
      series = rows.rows.map((r) => ({
        t: new Date(r.at).getTime(),
        p: Number(r.price),
      }));
    }
  }

  return json({ configured: true, price, liquidity, volume, traders, series });
}
