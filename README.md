# willthegavlegoatburn

A non-custodial prediction market on whether the Gävle goat burns in 2026.
Settled in USDC on Base. No fees, no house, no custody.

**Status:** front-end deployed to the server; `GavleGoatMarket` contract + test suite
passing locally. Auth API and indexer are next.

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
