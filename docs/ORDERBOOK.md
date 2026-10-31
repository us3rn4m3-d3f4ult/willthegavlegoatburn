# Adding an order book

## The decision this needs

We already have both mechanisms built and tested. The question is how they coexist,
because **two separate contracts = two prices for the same question**, which is worse
than either alone.

| Contract | Lines | Tests | Status |
|---|---|---|---|
| `GavleGoatMarket.sol` — order book (CLOB) | ~500 | **17 passing** | built, never deployed |
| `GavleGoatAmm.sol` — AMM backstop | ~360 | **16 passing** | **live on Base**, 10.882199 USDC seeded |

## Why an order book is the right primary market

- **Costs the operator nothing.** Users post their own offers and keep the spread.
- **Real price discovery.** Somebody choosing 62¢ is a genuine opinion; an AMM price is
  just "what the last click did".
- **No capital risk for you.** You are never the counterparty.
- **It's what Polymarket does**, and it's what traders expect to see.

Its weakness is the one we discussed: **day one it is empty**, and with no fees nobody
is paid to post. That is exactly what the AMM is good at — it always quotes.

## Three ways to combine them

### Option 1 — CLOB only (simplest, cheapest)
Deploy `GavleGoatMarket`, point the site at it, retire the AMM.

- Cost: ~$0.10 gas. **$0** of your capital at risk.
- Trade-off: an empty book until people post. No fallback price.
- The 10.882199 USDC already sitting in the AMM is not lost — as seeder you can call
  `redeem()` after resolution (Jan 2027) and get it back. It is simply idle until then.

### Option 2 — CLOB primary + AMM linked as backstop (right answer, more work)
One contract that holds one share ledger, with both:
- a limit order book users can post to, and
- the AMM pool filling any gap so a trade is always possible.

- Cost: ~$0.10 gas + a **new contract** (`GavleGoatBook.sol`, ~600 lines) and tests.
- Realistically **a full day of careful work**, plus the existing 33 tests have to be
  carried over and re-run.
- This is what "an order book and a backstop" actually requires — you cannot bolt two
  contracts together afterwards without ending up with two prices.

### Option 3 — deploy the CLOB next to the live AMM (not recommended)
Two live markets, two prices, both real money. Users will not know which one is "the"
price. Avoid.

## Recommendation

**Option 1 now, Option 2 when there is traffic.**

Reason: a book with no participants is the same as a book that does not exist, and the
AMM's only advantage (always quotable) is worth very little at $10 of depth. Get the
book live, let real users post offers, and only then spend a day building the combined
contract if the book is actually filling.

## What Option 1 involves

1. `forge create GavleGoatMarket` with native Base USDC + resolver + timestamps (~$0.10)
2. Point `NEXT_PUBLIC_MARKET_ADDRESS` at it, rebuild, redeploy
3. Swap the trade panel from `buy()`/`sell()` (AMM) to `placeAsk`/`placeBid`/`fillAsk`/`fillBid`
4. Wire the existing order book UI to real orders (it currently renders demo levels)
5. Ship `cancelOrder` so anyone can withdraw an unfilled offer

Steps 3–5 are front-end work; the contract side is already done and tested.

## Known gaps either way

- **No indexer**, so the book has to be read from events; the free Base RPC refuses
  `eth_getLogs` over wide ranges, so a paid RPC or an indexer is needed to render
  resting orders. This is the real blocker for showing a book, not the contract.
- **Resolution** stays a single key with a 72-hour timelock on both contracts.
