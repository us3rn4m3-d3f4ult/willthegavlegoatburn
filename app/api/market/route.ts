import { parseAbiItem } from "viem";
import { dbReady, getPool } from "@/lib/db";
import { AMM_ABI, CONFIGURED, MARKET_ADDRESS, publicClient } from "@/lib/web3";
import { json } from "@/lib/httpx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMPLE_MS = 55_000; // at most one stored point per minute
const BACKFILL_BLOCKS = 9_000n; // ~5 hours of Base blocks

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

  // Volume and traders from real logs. Fails soft: better a dash than a lie.
  let volume: number | null = null;
  let traders: number | null = null;
  try {
    const latest = await publicClient.getBlockNumber();
    const from = latest > BACKFILL_BLOCKS ? latest - BACKFILL_BLOCKS : 0n;
    const logs = await publicClient.getLogs({
      address: MARKET_ADDRESS,
      event: parseAbiItem(
        "event Bought(address indexed by, bool yes, uint256 usdcIn, uint256 sharesOut)",
      ),
      fromBlock: from,
      toBlock: latest,
    });
    const seen = new Set<string>();
    let sum = 0;
    for (const log of logs) {
      const args = log.args as { by?: string; usdcIn?: bigint };
      if (args.usdcIn) sum += Number(args.usdcIn) / 1e6;
      if (args.by) seen.add(args.by.toLowerCase());
    }
    volume = sum;
    traders = seen.size;
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
