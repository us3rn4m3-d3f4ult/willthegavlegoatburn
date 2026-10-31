# Testnet: which wallet to fund, and with what

## Short answer: you do not buy anything

Base Sepolia is a **test network**. Its ETH is worthless and is **given away free**
by faucets. There is nothing to purchase, and you cannot buy testnet ETH with real
money — anyone offering to sell it is scamming you.

So the flow is not "buy → transfer". It is **"faucet → paste address → receive"**.

## The address

```
0x413EF71C860D7f8957f1e9746937c814FE664BAf
```

This is the deployer wallet I generated. Its private key is in `.env.deploy`
(gitignored, never printed). **It is a throwaway testnet key** — mainnet must use a
hardware wallet.

## What it needs

| Asset | Amount | Why |
|---|---|---|
| **Base Sepolia ETH** | ~0.0005 | gas to deploy the contract (one tx) |
| **Test USDC** | 20–50 | to actually place orders and fill them once the market is live |

Two different assets, two different faucets. ETH alone gets the contract deployed
but you cannot trade with it.

## MetaMask

1. Open MetaMask → network dropdown → **Add network** → **Add a network manually**
2. Fill in:

| Field | Value |
|---|---|
| Network name | Base Sepolia |
| RPC URL | `https://sepolia.base.org` |
| Chain ID | `84532` |
| Currency symbol | ETH |
| Block explorer | `https://sepolia.basescan.org` |

3. Save, switch to it, then **copy your address** — but copy the one above, not your
   MetaMask account. The contract deploys from `0x413E…4BAf`.

## Faucets (free)

**ETH —** any one of these, paste `0x413EF71C860D7f8957f1e9746937c814FE664BAf`:

- <https://www.alchemy.com/faucets/base-sepolia> — 0.5 ETH/day, needs an Alchemy login
- <https://console.optimism.io/faucet> — Superchain faucet, Base included
- <https://portal.cdp.coinbase.com/products/faucet> — Coinbase Developer Platform
- <https://faucets.chain.link/base-sepolia> — also drips test USDC

**USDC —** <https://faucet.circle.com> → select **Base Sepolia** → 20 USDC per 2h.
Send it to your **MetaMask** address (the one you will trade from), not the deployer.

Some faucets require a small real balance on a mainnet or a GitHub account. If one
refuses, use another — they are all free.

## Verifying

```bash
# ETH arrived?
.tools/foundry/cast.exe balance 0x413EF71C860D7f8957f1e9746937c814FE664BAf --rpc-url https://sepolia.base.org

# USDC arrived? (your MetaMask address)
.tools/foundry/cast.exe call 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  "balanceOf(address)(uint256)" <your-metamask-address> --rpc-url https://sepolia.base.org
```

## Then tell me, and I run

```bash
python scripts/deploy_contract.py --broadcast
```

It deploys, verifies on Basescan (if `BASESCAN_API_KEY` is set), and writes
`NEXT_PUBLIC_MARKET_ADDRESS` into `.env.local` so the front end switches from demo
data to real reads.

## Things that will cost you money or lose your funds — all avoidable

- ❌ **Never send mainnet ETH/USDC to a testnet address.** It is not recoverable.
- ❌ **Never paste a seed phrase anywhere**, including into me.
- ❌ Don't buy testnet tokens. They are free.
- ⚠️ The deployer key in `.env.deploy` is plaintext on your laptop. Fine for a
  testnet with no value. **Not** fine for mainnet — use a hardware wallet there, and
  set the resolver to a Safe (`docs/DEPLOY_CONTRACT.md`).
