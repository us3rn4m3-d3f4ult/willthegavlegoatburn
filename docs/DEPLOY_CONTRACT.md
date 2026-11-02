# Deploying the contract

> **Status: deployed.** The live CLOB is at `0xcfa25534fc14929e29bd1f4fefe5cd4d5ce9880f`
> on Base mainnet and the site reads it (`docs/ORDERBOOK.md`). This page is the
> runbook for deploying a *new* copy, e.g. next year's market.

| | |
|---|---|
| Deployer address | `0x413EF71C860D7f8957f1e9746937c814FE664BAf` |
| Network | Base Sepolia (chain id `84532`) |
| USDC (Circle testnet) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` — verified on-chain: `symbol() = "USDC"`, `decimals() = 6` |
| Resolver | same address **for testnet only** (mainnet must be a Safe) |
| Betting closes | `1798758000` — 1 Jan 2027 00:00 CET |
| Resolution deadline | `1801350000` — 31 Jan 2027 00:00 CET |
| Void after | `1803942000` — deadline + 30 days (computed in the contract) |
| Predicted address | `0x5c1792ab4B81654656913A3F01C4e92Cb28601E9` *(only if this wallet's next tx is the deploy)* |

---

## 1. Fund the deployer — free

Need roughly **0.0005 ETH** on Base Sepolia. Any of these, all free:

- <https://www.alchemy.com/faucets/base-sepolia> — 0.5 ETH/day
- <https://portal.cdp.coinbase.com/products/faucet> — needs a Coinbase Developer account
- <https://console.optimism.io/faucet> — Superchain faucet, Base included
- <https://faucets.chain.link/base-sepolia> — also drips test USDC

Paste `0x413EF71C860D7f8957f1e9746937c814FE664BAf` as the recipient.

For **test USDC** (needed to actually trade, not to deploy):
<https://faucet.circle.com> → Base Sepolia → 20 USDC per 2 hours.

Confirm the balance:

```bash
.tools/foundry/cast.exe balance 0x413EF71C860D7f8957f1e9746937c814FE664BAf --rpc-url https://sepolia.base.org
```

## 2. Simulate, then broadcast

```bash
python scripts/deploy_contract.py              # dry run: proves it compiles and wires up
python scripts/deploy_contract.py --broadcast  # deploys + verifies on Basescan
```

`--broadcast` also writes `NEXT_PUBLIC_MARKET_ADDRESS` into `.env.local`, which is
what flips the site from demo data to real reads.

Verification needs `BASESCAN_API_KEY` in `.env.deploy` (free from
<https://basescan.org/myapikey>). Without it the deploy still succeeds — you just
verify manually later.

## 3. Point the site at it

```bash
python scripts/deploy.py     # rebuild + restart with the new .env.local
```

Then check that the frontend is reading the chain, not `lib/market.ts`.

---

## Mainnet checklist — do not skip any of these

- [ ] Resolver is a **Safe**, deployed from a hardware wallet, 3-of-5 recommended.
      Set `RESOLVER_ADDRESS` to the Safe. Never an EOA — the EOA's key would be the
      single point of failure for every payout decision.
- [ ] `USDC_ADDRESS` is **native** USDC on Base (`0x8335…2913`). Verify on
      circle.com, do not copy it from a chat message. Testnet's `0x036C…` is wrong
      on mainnet.
- [ ] Deploy from a **hardware wallet**, not the throwaway key in `.env.deploy`.
- [ ] Independent review of `GavleGoatMarket.sol` completed and findings closed.
- [ ] `forge test` green, plus a stateful invariant campaign.
- [ ] Timestamps re-derived for the real season — they are immutable forever.
- [ ] Deploy Sepolia first, exercise every path (bet, fill, cancel, propose,
      finalize, redeem, void) with real transactions before touching mainnet.
- [ ] Publish the deployed address and verified source on `/rules` so anyone can
      read the contract before depositing a single USDC.

## What cannot be undone

The contract has no owner and no upgrade path. Once deployed:

- the fee is zero forever,
- the close and resolution timestamps are fixed,
- the resolver address is fixed,
- a bug cannot be patched — only mitigated by the `voidMarket()` escape hatch.

If any of the above is wrong, deploy a new contract. That is the price of having
nothing an operator can switch off.
