import { BOOK_ABI, BOOK_ADDRESS, BOOK_CONFIGURED, publicClient } from "@/lib/web3";
import { json } from "@/lib/httpx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Level = { id: number; price: number; shares: number; maker: string; isYes: boolean };

/**
 * The book is read straight from contract state — nextOrderId() then orders(i) —
 * so it needs no indexer and no log scanning. Order counts are small by design
 * (the contract caps open orders per wallet at 32).
 */
export async function GET(req: Request) {
  const maker = new URL(req.url).searchParams.get("maker")?.toLowerCase() ?? "";
  if (!BOOK_CONFIGURED) return json({ configured: false, asks: [], bids: [], mine: [] });


  try {
    const [count, trading] = await Promise.all([
      publicClient.readContract({ address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "nextOrderId" }),
      publicClient.readContract({ address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "isTrading" }),
    ]);

    const total = Number(count as bigint) - 1;
    const ids = Array.from({ length: Math.min(total, 200) }, (_, i) => BigInt(i + 1));
    const now = Math.floor(Date.now() / 1000);

    const raw = await Promise.all(
      ids.map((id) =>
        publicClient
          .readContract({ address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "orders", args: [id] })
          .catch(() => null),
      ),
    );

    const asks: Level[] = [];
    const bids: Level[] = [];
    const mine: Level[] = [];

    raw.forEach((o, i) => {
      if (!o) return;
      const [makerAddr, isYes, isAsk, active, expiresAt, shares, price] = o as readonly [
        string,
        boolean,
        boolean,
        boolean,
        bigint,
        bigint,
        bigint,
        bigint,
      ];
      if (!active || Number(expiresAt) <= now || shares === 0n) return;
      const level: Level = {
        id: Number(ids[i]),
        price: Number(price) / 1e18,
        shares: Number(shares) / 1e6,
        maker: makerAddr,
        isYes,
      };
      if (maker && makerAddr.toLowerCase() === maker) mine.push(level);
      (isAsk ? asks : bids).push(level);
    });

    asks.sort((a, b) => a.price - b.price);
    bids.sort((a, b) => b.price - a.price);
    mine.sort((a, b) => b.id - a.id);

    return json({ configured: true, trading: Boolean(trading), asks, bids, mine, count: total });
  } catch {
    return json({ configured: true, error: "rpc_unavailable", asks: [], bids: [], mine: [] }, 503);
  }
}
