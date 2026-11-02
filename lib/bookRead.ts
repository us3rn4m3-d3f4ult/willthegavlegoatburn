import { BOOK_ABI, BOOK_ADDRESS, publicClient } from "./web3";

/**
 * Server-side order book reader, shared by `/api/orders` and `/api/market`.
 *
 * One `multicall` per read (multicall3 is on Base) instead of one `eth_call`
 * per order id — a 200-order book used to cost 200 round trips per request —
 * plus a 3 second cache so a burst of tabs shares one RPC burst.
 *
 * Server-only: it holds module state, so it must never be imported by a client
 * component.
 */

export type RawLevel = {
  id: number;
  price: number;
  shares: number;
  maker: string;
  isYes: boolean;
  isAsk: boolean;
};

export type BookState = { levels: RawLevel[]; trading: boolean; count: number };

const MAX_ORDERS = 200;
const CACHE_MS = 3_000;

let cache: { at: number; state: BookState } | null = null;
let inflight: Promise<BookState> | null = null;

async function read(): Promise<BookState> {
  const [count, trading] = (await publicClient.multicall({
    contracts: [
      { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "nextOrderId" },
      { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "isTrading" },
    ],
    allowFailure: false,
  })) as [bigint, boolean];

  const total = Number(count) - 1;
  if (total < 1) return { levels: [], trading: Boolean(trading), count: total };

  const ids = Array.from({ length: Math.min(total, MAX_ORDERS) }, (_, i) => BigInt(i + 1));
  const rows = await publicClient.multicall({
    contracts: ids.map((id) => ({
      address: BOOK_ADDRESS,
      abi: BOOK_ABI,
      functionName: "orders" as const,
      args: [id] as const,
    })),
    allowFailure: true,
  });

  const now = Math.floor(Date.now() / 1000);
  const levels: RawLevel[] = [];

  rows.forEach((row, i) => {
    if (row.status !== "success") return;
    const [maker, isYes, isAsk, active, expiresAt, shares, price] = row.result as readonly [
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
    levels.push({
      id: Number(ids[i]),
      price: Number(price) / 1e18,
      shares: Number(shares) / 1e6,
      maker,
      isYes,
      isAsk,
    });
  });

  return { levels, trading: Boolean(trading), count: total };
}

/** Cached read; concurrent callers share one RPC burst instead of racing. */
export async function readLevels(): Promise<BookState> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.state;
  if (inflight) return inflight;
  inflight = read()
    .then((next) => {
      cache = { at: Date.now(), state: next };
      return next;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
