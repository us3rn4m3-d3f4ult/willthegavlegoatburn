GAVLE GOAT MARKET - PUBLIC API
==============================
Version 1. Base mainnet (chain id 8453). No key, no signup, read-only.

BASE URL
  https://willthegavlegoatburn.com

ENDPOINT: account value in the market
  GET /api/public/account?address=0x<40 hex chars>

  CORS: Access-Control-Allow-Origin: *  (call it from any origin)
  Cache: public, max-age=10
  Rate limit: 120 requests per minute per IP (429 when exceeded)

WHAT IT RETURNS
  The money that wallet has inside the market contract. It does NOT include
  the wallet's own balance (MetaMask, Coinbase Wallet, etc).

  totalInMarketUsdc   THE NUMBER. Free USDC credited by the contract, plus
                      USDC escrowed in resting bids. Excludes wallet balance.
  usdc.free           credited and withdrawable right now
  usdc.inOpenOrders   escrowed in bids that have not filled yet
  shares.yes / .no    outcome shares held in the contract
  shares.lockedYes/.lockedNo   of those, the ones promised to resting asks
  markPriceUsdc       current yes price 0..1, null when the book is empty
  openOrdersCount     number of resting orders
  openOrders[]        id, side BID|ASK, outcome YES|NO, priceUsdc, shares,
                      escrow, expiresAt (unix seconds)
  at                  server timestamp, ISO 8601

EXAMPLE
  curl "https://willthegavlegoatburn.com/api/public/account?address=0xA4DC52F054b6feFfD54B89f7d87129B1c451a02f"

EXAMPLE RESPONSE
  {
    "ok": true, "version": 1, "chainId": 8453,
    "address": "0xA4DC...a02f",
    "totalInMarketUsdc": 45.0,
    "usdc": { "free": 0.0, "inOpenOrders": 45.0 },
    "shares": { "yes": 0, "no": 0, "lockedYes": 0, "lockedNo": 0 },
    "markPriceUsdc": 0.5,
    "openOrdersCount": 2,
    "openOrders": [ { "id": 9, "side": "BID", "outcome": "YES",
                      "priceUsdc": 0.1, "shares": 450, "escrow": 45,
                      "expiresAt": 1798761600 } ],
    "at": "2026-11-02T14:00:00.000Z"
  }

OTHER PUBLIC ENDPOINTS
  GET /api/market    price, liquidity, volume, traders, price series
  GET /api/orders    full order book (asks, bids)
  GET /api/trades    recent fills

NOTES FOR A CONSUMER
  - Amounts are decimal USDC, not raw integers.
  - shares are not valued here. Value them with markPriceUsdc if needed:
    yes * mark + no * (1 - mark).
  - An address that never traded returns zeros, not an error.
  - Errors: 400 bad_address, 429 rate_limited, 503 rpc_unavailable.
  - No authentication exists, so nothing here is private: every field is
    already public on-chain.