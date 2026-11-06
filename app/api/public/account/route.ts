import { isAddress, type Address } from "viem";
import { BOOK_ABI, BOOK_ADDRESS, BOOK_CONFIGURED, publicClient } from "@/lib/web3";
import { clientIp, createLimiter, json } from "@/lib/httpx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, keyless, read-only. Returns what the market contract holds for one
 * wallet: credited USDC, USDC escrowed in resting orders, and open orders.
 * No wallet balances, no PII, no write paths.
 */

const limiter = createLimiter(120, 60_000);
const MAX_ORDER_SCAN = 200;
const DECIMALS = 1_000_000;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=10",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

type Order = {
  id: number;
  maker: string;
  side: "BID" | "ASK";
  outcome: "YES" | "NO";
  priceUsdc: number;
  shares: number;
  escrow: number;
  expiresAt: number;
};

export async function GET(req: Request) {
  if (!limiter(clientIp(req))) return json({ ok: false, error: "rate_limited" }, 429, CORS);
  if (!BOOK_CONFIGURED) return json({ ok: false, error: "not_configured" }, 503, CORS);

  const raw = new URL(req.url).searchParams.get("address") ?? "";
  if (!isAddress(raw)) {
    return json({ ok: false, error: "bad_address", hint: "?address=0x…" }, 400, CORS);
  }
  const address = raw as Address;
  const lower = address.toLowerCase();

  let free = 0n;
  let yesShares = 0n;
  let noShares = 0n;
  let lockedYes = 0n;
  let lockedNo = 0n;
  let all: Order[] = [];

  try {
    const read = (fn: "usdcBalance" | "yesBalance" | "noBalance" | "lockedYes" | "lockedNo") =>
      publicClient.readContract({
        address: BOOK_ADDRESS,
        abi: BOOK_ABI,
        functionName: fn,
        args: [address],
      }) as Promise<bigint>;

    const [f, y, n, ly, ln] = await Promise.all([
      read("usdcBalance"),
      read("yesBalance"),
      read("noBalance"),
      read("lockedYes"),
      read("lockedNo"),
    ]);
    free = f;
    yesShares = y;
    noShares = n;
    lockedYes = ly;
    lockedNo = ln;

    const count = (await publicClient.readContract({
      address: BOOK_ADDRESS,
      abi: BOOK_ABI,
      functionName: "nextOrderId",
    })) as bigint;

    const total = Math.min(Number(count) - 1, MAX_ORDER_SCAN);
    const now = Math.floor(Date.now() / 1000);
    if (total > 0) {
      const ids = Array.from({ length: total }, (_, i) => BigInt(i + 1));
      const rows = await Promise.all(
        ids.map((id) =>
          publicClient
            .readContract({ address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "orders", args: [id] })
            .catch(() => null),
        ),
      );
      all = [];
      rows.forEach((o, i) => {
        if (!o) return;
        const [maker, isYes, isAsk, active, expiresAt, shares, price, escrow] = o as readonly [
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
        all.push({
          id: i + 1,
          maker: String(maker).toLowerCase(),
          side: isAsk ? "ASK" : "BID",
          outcome: isYes ? "YES" : "NO",
          priceUsdc: Number(price) / 1e18,
          shares: Number(shares) / DECIMALS,
          escrow: Number(escrow) / DECIMALS,
          expiresAt: Number(expiresAt),
        });
      });
    }
  } catch {
    return json({ ok: false, error: "rpc_unavailable" }, 503, CORS);
  }

  const mine = all.filter((o) => o.maker === lower);

  // Position the account holds inside the contract only.
  const escrowedUsdc = mine
    .filter((o) => o.side === "BID")
    .reduce((s, o) => s + o.escrow, 0);
  const freeUsdc = Number(free) / DECIMALS;

  // Mark price: best YES bid/ask across the whole book, NO legs mirrored.
  const bidsYes = [
    ...all.filter((o) => o.outcome === "YES" && o.side === "BID").map((o) => o.priceUsdc),
    ...all.filter((o) => o.outcome === "NO" && o.side === "ASK").map((o) => 1 - o.priceUsdc),
  ];
  const asksYes = [
    ...all.filter((o) => o.outcome === "YES" && o.side === "ASK").map((o) => o.priceUsdc),
    ...all.filter((o) => o.outcome === "NO" && o.side === "BID").map((o) => 1 - o.priceUsdc),
  ];
  const bestBid = bidsYes.length ? Math.max(...bidsYes) : undefined;
  const bestAsk = asksYes.length ? Math.min(...asksYes) : undefined;
  const mark =
    bestBid !== undefined && bestAsk !== undefined
      ? (bestBid + bestAsk) / 2
      : bestAsk ?? bestBid ?? null;

  const yes = Number(yesShares) / DECIMALS;
  const no = Number(noShares) / DECIMALS;

  return json(
    {
      ok: true,
      version: 1,
      at: new Date().toISOString(),
      chainId: 8453,
      contract: BOOK_ADDRESS,
      address,
      // The single number a finance app needs: everything this wallet has sitting
      // in the market, excluding any wallet balance.
      totalInMarketUsdc: Number((freeUsdc + escrowedUsdc).toFixed(6)),
      usdc: {
        free: Number(freeUsdc.toFixed(6)),
        inOpenOrders: Number(escrowedUsdc.toFixed(6)),
      },
      shares: {
        yes: Number(yes.toFixed(6)),
        no: Number(no.toFixed(6)),
        lockedYes: Number((Number(lockedYes) / DECIMALS).toFixed(6)),
        lockedNo: Number((Number(lockedNo) / DECIMALS).toFixed(6)),
      },
      markPriceUsdc: mark,
      openOrdersCount: mine.length,
      openOrders: mine.map(({ maker: _maker, ...rest }) => rest),
      notes: {
        totalInMarketUsdc: "free USDC credited by the contract plus USDC escrowed in resting bids",
        excludesWalletBalance: true,
        sharesValuedSeparately: true,
        docs: "/docs/API_PUBLIC.txt",
      },
    },
    200,
    CORS,
  );
}
