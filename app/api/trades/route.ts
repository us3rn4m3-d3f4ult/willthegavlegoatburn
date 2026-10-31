import { dbReady, getPool } from "@/lib/db";
import { json } from "@/lib/httpx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recent fills, read from the table the market scan keeps up to date. */
export async function GET() {
  if (!(await dbReady())) return json({ trades: [] });
  const pool = getPool();
  if (!pool) return json({ trades: [] });

  const { rows } = await pool
    .query(
      `select block, order_id, taker, shares::text as shares, usdc::text as usdc, at
         from trades
        order by block desc, log_index desc
        limit 25`,
    )
    .catch(() => ({ rows: [] as Record<string, unknown>[] }));

  return json({
    trades: rows.map((r) => ({
      block: Number(r.block),
      orderId: Number(r.order_id),
      taker: String(r.taker),
      shares: Number(r.shares),
      usdc: Number(r.usdc),
      at: new Date(r.at as string).getTime(),
    })),
  });
}
