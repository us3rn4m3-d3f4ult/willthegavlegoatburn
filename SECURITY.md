# Security policy

## Reporting a vulnerability

Email **contact@willthegavlegoatburn.com** with a subject starting `SECURITY`.

Please include: what you found, how to reproduce it, and the impact you believe it
has. If you want to encrypt, ask for a PGP key in your first message — do not send
exploit details to a public issue, a Discord, or X.

**In scope**

- `GavleGoatMarket.sol` and anything that can move, freeze or misdirect funds
- the web app, its API routes, and the session/auth implementation
- the deployment (headers, TLS, container config)

**Out of scope**

- findings that require a compromised device, a malicious browser extension, or the
  user's own seed phrase
- rate limiting that only affects availability for a single IP
- anything in `docs/SECURITY_AUDIT.md` already listed as accepted, unless you think
  the acceptance rationale is wrong — that is worth telling us

## What to expect

This is a small, unfunded project. Honest expectations:

- acknowledgement within **7 days**
- a fix or a written decision within **90 days**
- credit in the fix commit if you want it

There is no bug bounty budget. Please do not test against mainnet with other people's
funds.

## The one thing to understand before using this software

The contract has **no owner and no upgrade path**. A bug cannot be patched, only
mitigated by `voidMarket()`. Do not deposit more than you can afford to lose, and
read `docs/SECURITY_AUDIT.md` before trusting any of it.

## Supported versions

Only the currently deployed commit is supported. There are no maintained release
branches.
