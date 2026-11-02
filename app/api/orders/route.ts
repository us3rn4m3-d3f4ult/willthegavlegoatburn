import { readLevels } from "@/lib/bookRead";
import { BOOK_CONFIGURED } from "@/lib/web3";
import { json } from "@/lib/httpx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Level = { id: number; price: number; shares: number; maker: string; isYes: boolean };

/**
 * The public order book, straight from contract state (no indexer). The reading
 * and caching lives in `lib/bookRead.ts` so `/api/market` shares it.
 */
export async function GET(req: Request) {
  const maker = new URL(req.url).searchParams.get("maker")?.toLowerCase() ?? "";
  if (!BOOK_CONFIGURED) return json({ configured: false, asks: [], bids: [], mine: [] });

  try {
    const { levels, trading, count } = await readLevels();

    const asks: Level[] = [];
    const bids: Level[] = [];
    const mine: Level[] = [];

    for (const level of levels) {
      const { isAsk, ...publicLevel } = level;
      if (maker && level.maker.toLowerCase() === maker) mine.push(publicLevel);
      (isAsk ? asks : bids).push(publicLevel);
    }

    asks.sort((a, b) => a.price - b.price);
    bids.sort((a, b) => b.price - a.price);
    mine.sort((a, b) => b.id - a.id);

    return json({ configured: true, trading, asks, bids, mine, count }, 200, {
      // Public book may sit in a shared cache for a couple of seconds; a
      // per-address `mine` list must not, even though these orders are public.
      "Cache-Control": maker ? "private, max-age=2" : "public, max-age=2, stale-while-revalidate=3",
    });
  } catch {
    return json({ configured: true, error: "rpc_unavailable", asks: [], bids: [], mine: [] }, 503);
  }
}
