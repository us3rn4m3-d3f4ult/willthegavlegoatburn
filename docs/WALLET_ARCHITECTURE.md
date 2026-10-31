# Wallet architecture — why there is no custodial balance

## What was asked

> "We will give every user a wallet that they can deposit into and maybe also withdraw from."

That is a **custodial wallet**, and it is the one thing in this project that must not ship.

---

## Why not custodial

If the server holds user USDC, then:

1. **You are a MiCA crypto-asset service provider.** "Custody and administration of
   crypto-assets on behalf of clients" is an authorised service under Regulation
   (EU) 2023/1114, applicable in full since 30 Dec 2024. In the Netherlands the
   authorisation is granted by the **AFM**. Operating without it is not a grey area.
2. **You also become a money transmitter** for AML purposes (Wwft), with a full
   KYC/AML programme, transaction monitoring, travel-rule handling and record
   retention.
3. **One compromise is total loss.** Today a server breach leaks email addresses.
   With custody, a server breach or a mis-signed withdrawal script loses every
   user's balance, permanently, with no insurance and no way to make them whole.
4. **It contradicts the product story.** The entire safety claim — "the website is
   not the vault" — dies the moment there is a vault.

Custody is a $100k+ engineering-and-compliance programme. It is not a feature.

---

## What we build instead: an embedded smart account (ERC-4337)

The user gets something that *feels* exactly like "a wallet we made them", without
us ever holding a key.

| | Custodial (rejected) | **Smart account (chosen)** |
|---|---|---|
| Who holds the key | You, on a server | **The user, in a passkey on their device** |
| Login | email + password | email + passkey (one tap, biometric) |
| Can you move their funds | Yes — that's the problem | **No. There is no code path.** |
| Regulatory position | MiCA CASP, AFM licence required | Self-custody; you publish a front-end |
| Failure mode of a hack | Total loss of all balances | Session stolen → profile only |
| Recovery | You reset it | Passkey sync / guardian recovery |
| Gas | You pay for everything | Sponsored by paymaster, or paid in USDC |

### Flow the user sees

1. **Create account** → email + password (profile) → one tap creates a **passkey**
   → that passkey controls their smart account address.
2. **Deposit** → "Add funds" → Coinbase Onramp (card/bank → USDC lands directly in
   *their* smart account) or withdraw from an exchange to that address.
3. **Trade** → sign with biometrics. Gas is sponsored, so no ETH needed.
4. **Withdraw** → send USDC to any address they control. Signed by their passkey.
5. **Lose the device** → passkey sync (iCloud Keychain / Google Password Manager)
   or a pre-configured guardian, never a support ticket to you.

### Provider choice

| Option | Verdict |
|---|---|
| **Coinbase Smart Wallet** | Free, passkey-based, ERC-4337, pairs with Coinbase Onramp, USDC-native on Base. **Recommended.** |
| **Privy** | Email/social login + embedded wallet (MPC, user-held share). Fastest build, best UX for non-crypto users, paid. Strong second choice. |
| Dynamic | Similar to Privy, more chains than needed here. |
| Safe{Core} + passkey module | Most control, most work. Overkill for one market. |

Both recommended options keep keys out of your infrastructure. That is the
requirement; everything else is taste.

### What this means for the backend

- The API stores: email, password hash, session, and a **mapping from account to
  smart-account address**. Nothing else.
- The API **never** stores a private key, seed phrase, or encrypted key share.
- Every state-changing transaction originates in the browser, signed by the user's
  passkey, sent through a bundler. Our server is not in the signing path.
- If the whole server is seized, evaporated or handed to an attacker, **no funds
  can move**. The contract and the users' passkeys are unaffected.

### Env wiring

```
NEXT_PUBLIC_PRIVY_APP_ID=      # if using Privy
NEXT_PUBLIC_WC_PROJECT_ID=     # WalletConnect / Reown project id
NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913   # verify on circle.com
```

---

## The one UX cost you should know about

Passkey-only wallets break for users on old browsers or with biometrics disabled.
Mitigation: always allow **"connect an existing wallet"** (MetaMask, Rabby, Coinbase
Wallet) as a first-class path — the site must be fully usable with no account and
no embedded wallet at all. That is also what keeps the claim "trading never
requires an account" honest.
