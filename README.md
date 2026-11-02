# willthegavlegoatburn

A non-custodial prediction market on whether the Gävle goat burns in 2026.
Settled in USDC on Base. No protocol fees, no house, no custody.

**Status:** live at https://willthegavlegoatburn.com — accounts, order book,
trading, comments (with GIPHY), email verification, backups and monitoring are
all running. The order book has no maker, so market buys need someone to post a
limit order first.

---

## Stack

| Layer | What |
|---|---|
| Contracts | Solidity + Foundry (`contracts/`), a CLOB on Base with an internal USDC balance and per-caller `withdraw` |
| Web | Next 15 (App Router) + React 19 + Tailwind 4, no UI framework |
| Chain reads | viem public client, `multicall`-batched, 3 s server cache |
| Data | Postgres 16 in Compose: accounts, sessions, comments, page counts, error log |
| Wallet | injected EIP-6963 / WalletConnect 2 (mobile); the user's own wallet signs every trade |
| Ops | Docker Compose + Caddy + Cloudflare, `scripts/deploy.py` one-command deploy |

## Quick start

```bash
npm install
cp .env.example .env.local        # fill in the chain + database values
npm run dev                       # http://localhost:3000
npm run typecheck                 # what CI runs
```

```bash
# contracts (Foundry is vendored in .tools/, gitignored)
cd contracts && forge install foundry-rs/forge-std && forge test -vv
```

## Deploying

```bash
python scripts/deploy.py          # tar → upload → docker build → up -d → smoke checks
python scripts/deploy.py --no-build   # config-only change
```

Deploys are gated: the script fails if the app cannot reach the RPC.

## Layout

| Path | What lives there |
|---|---|
| `app/` | routes; `app/api/*` are route handlers (auth, comments, market, orders, ops) |
| `components/` | client components; `useSession`, `useOrderBook` are shared stores |
| `lib/` | server + shared logic: auth, db, moderation, mail, gifs, book maths |
| `contracts/` | the market and AMM contracts + Foundry tests |
| `infra/` | Compose, Caddyfile, hardening script, backup timer |
| `scripts/` | deploy, database setup, Python test suites (see `scripts/README.md`) |
| `docs/` | runbook, accounts, email, gifs, metrics, security audit |

Start with **`docs/RUNBOOK.md`** (is it up, backups, rollback), then
**`docs/ACCOUNTS.md`** (how auth works) and **`docs/SECURITY_AUDIT.md`**
(findings, what is fixed, what is accepted with reasoning).

## Tests

```bash
cd contracts && forge test -vv     # contract suite
python scripts/test_auth.py        # auth API, against a running instance
python scripts/test_recovery.py
python scripts/test_comments.py
```

CI runs `forge test` and `npx tsc --noEmit` on every push (`.github/workflows/ci.yml`).

---

## Contracts

```bash
# Foundry is vendored locally in .tools/ (gitignored), so a fresh clone needs it:
#   curl -L https://foundry.paradigm.xyz | bash   # then restart the shell
cd contracts
forge install foundry-rs/forge-std   # contracts/lib/ is gitignored
forge test -vv
```

`GavleGoatMarket.sol` — one market, one question, USDC, **zero fees**:

| Area | Functions |
|---|---|
| Collateral | `deposit`, `withdraw` (never pausable) |
| Shares | `split` (1 USDC → 1 YES + 1 NO), `merge` |
| Book | `placeAsk`, `placeBid` (USDC escrowed), `fillAsk`, `fillBid`, `cancelOrder` |
| Resolution | `proposeResolution` (resolver, 72h timelock, freezes the book), `finalizeResolution`, `voidMarket`, `redeem`, `redeemVoided` |

No owner. No fee switch. No treasury. No upgrade path. The only privileged action
is proposing which side won, and it cannot move funds — if the resolver vanishes,
`voidMarket()` returns 0.5 per share to everyone, permissionlessly.

Invariants asserted in the suite: `solvencyGap() >= 0` always, `totalYes == totalNo`
while trading, third parties cannot cancel a live order, fills revert the instant
the market is closed or a resolution is proposed.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build (validated)
npm run typecheck
```

> On Windows, `npm` may be blocked by the PowerShell execution policy. Use
> `npm.cmd run dev` instead of changing machine-wide policy.

---

## Layout

```
app/                routes (all 13 prerender statically today)
  page.tsx          the market
  account/          profile shell (positions, orders, security)
  privacy|terms|risk|cookies|legal/   legal set
  rules/            resolution rules — the canonical public document
  how-it-works/  goat-history/  activity/  status/  not-found
components/         Header, Footer, AbstractAvatar, OddsBar, OrderBook,
                    PriceChart, TradePanel, Countdown, LegalShell
lib/                market data + formatters (swapped for on-chain reads later)
infra/              Caddyfile, docker-compose.yml, harden.sh
docs/               SETUP.md, WALLET_ARCHITECTURE.md, RESOLUTION_RULES.md
```

## Design tokens

Black canvas `#000`, surfaces `#0B0B0D`, borders `#1C1C21`, text `#FAFAFA`.
YES = ember `#FF5C2B → #FFB020`. NO = cold `#4C8DFF`. Radius 14px cards /
10px controls. Tabular numerals everywhere a price appears. All tokens live in
`app/globals.css` under `@theme`.

## Non-negotiables for anything added here

1. **No custody.** The server never holds user funds and never holds a key.
2. **No fee switch.** No owner, no treasury, no withdraw over user collateral.
3. **Account sessions cannot move funds.** Every transaction is signed by the
   user's wallet.
4. **The contract is the vault, not the website.** Losing the domain or the server
   must never lose a position.
5. **No third-party scripts in the signing flow.** Supply-chain wallet drainers are
   the number-one theft vector.

## Docs

| File | What it covers |
|---|---|
| `docs/SETUP.md` | Server hardening, Cloudflare DNS + TLS, firewall, deploy |
| `docs/SEO.md` | What's automated, the Search Console step, content + backlink plan |
| `docs/DEPLOY_CONTRACT.md` | Faucets, deploy commands, and the mainnet checklist |
| `docs/RESOLUTION_RULES.md` | The frozen resolution criteria and the evidence process |
| `docs/ORDERBOOK.md` | How the order book works: orders, fills, deposits, splits |
| `docs/ACCOUNTS.md` | Registration, sessions, recovery codes, deletion |
| `.env.example` | Every variable the app needs |

## Legal

Not affiliated with Gävle kommun, Visit Gävle or the Southern Merchants. All legal
pages are marked **DRAFT** and require review by Dutch counsel before launch —
particularly: whether event contracts are licensable at all in the Netherlands,
and whether a zero-fee non-custodial front-end changes that answer.
