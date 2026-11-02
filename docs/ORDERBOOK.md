# Order book: what is actually deployed

The market is a **CLOB** (`GavleGoatMarket.sol`): users post their own bids and
asks, the contract holds an internal USDC balance, and `withdraw` is per-caller —
no owner, no pause, no fee switch, no treasury.

## On Base mainnet (chain 8453)

| Contract | Address | State |
|---|---|---|
| `GavleGoatMarket` (CLOB) | `0xcfa25534fc14929e29bd1f4fefe5cd4d5ce9880f` | **the live market** — this is `NEXT_PUBLIC_BOOK_ADDRESS`, and everything the site reads |
| `GavleGoatMarket` (earlier deploy) | `0x5c1792ab4B81654656913A3F01C4e92Cb28601E9` | not read by the site — holds **$10.88 USDC**, credited to nobody (verified: `usdcBalance` of the deployer is 0, and it predates `lockedYes`) |
| `GavleGoatAmm` (AMM backstop) | address not recorded here | seeded with 10.882199 USDC by the deployer; not used by the site |

Two decisions this leaves open, both cheap:

1. **The AMM seed.** As seeder you can `redeem()` after resolution to get the
   ~$10.88 back; until then it just sits there. Nothing on the site reads it, so
   the only cost of leaving it is the capital.
2. **The older CLOB.** It has no orders and nothing points at it. Ignore it; the
   address is recorded above only so nobody re-discovers it and wonders.

## How the site reads the book

No indexer: `app/api/orders/route.ts` calls `nextOrderId()` then `orders(i)` for
every id in **one multicall** (multicall3), keeps the raw levels for 3 seconds,
and filters per request. `lib/bookRead.ts` is shared with `/api/market` so the
price chart and the book always agree. A 200-order book used to cost 200 RPC calls
per request *per open tab*; it is now one call plus cache.

The client polls that once (`components/useOrderBook.ts`) and components subscribe,
so the order book, trade panel, mobile bar and open orders share one timer.

## The thing that actually matters

**An empty book is the launch state.** With no maker, a market buy has nothing to
fill — the UI says so and points people at limit orders. That is a product problem,
not a code problem: either seed a two-sided book from the project wallet or accept
a limit-only start.

Seeding is done by hand, through the trade panel: a limit **sell** makes the panel
split USDC into Yes + No shares for you, and a limit **buy** commits cash. Two
prices either side of 50¢ is enough to make the book usable; deeper ladders only
matter once there is flow.

Everything is reversible: close your orders, then **Withdraw** — it merges the
Yes + No pairs back into $1.00 each and sends the cash out. A seed costs gas, not
capital.

Seed from a throwaway wallet rather than the resolver key: resolution is the one
thing that key exists for.

## Known gaps

- **No maker / no liquidity programme.** See above.
- **Resolution is one key**, the same address as the deployer, with a timelock and
  a permissionless `voidMarket()` fallback after the deadline (`docs/RUNBOOK.md`
  covers the key handling).
