# Security audit — self-review, 30 October 2026

## What this is, and what it is not

This is a **self-review by the engineer who wrote the code**. It is useful — it found
four real defects during the review — but it is **not an independent audit** and must
never be presented as one. A reviewer who wrote the code shares the blind spots that
produced the bugs.

For an open-source, non-custodial project the honest framing is:

> "We publish a self-review and the full test suite. The contracts have not been
> independently audited. Do not deposit more than you can afford to lose."

An independent review of `GavleGoatMarket.sol` is the one item that cannot be
self-served. Everything below is fixed, accepted-with-rationale, or a launch blocker.

## Scope

| Component | Reviewed |
|---|---|
| `contracts/src/GavleGoatMarket.sol` (≈500 lines) | full read + 17 tests |
| `middleware.ts`, `lib/*.ts`, `app/api/**` | full read |
| `infra/` (Dockerfile, compose, Caddyfile, harden.sh) | full read |
| Live box `148.135.185.56` | probed: SSH, firewall, TLS, headers, mail ports |
| Wallet integration | **does not exist yet** — F-01 |
| Third-party services in the request path | none, by design |

## Summary

| ID | Severity | Finding | Status |
|---|---|---|---|
| F-01 | **High** | Wallet front-end unimplemented; approval/supply-chain risk lands later | Open (pre-launch) |
| F-02 | **High** | Contract not independently audited; resolution trusted to one key | Open (blocks mainnet) |
| F-03 | **High** | No backups of `pgdata` or the signup list; no restore test | Open |
| F-04 | Medium | CSP allows `'unsafe-inline'` scripts (nonce propagation measured broken) | Accepted |
| F-05 | Medium | Rate limits in-process only; **edge WAF rules never created** | Open |
| F-06 | Medium | No CI, no dependency scanning, no automated test run | Open |
| F-07 | Medium | Root password + deployer key in plaintext `.env.deploy` | Partly fixed |
| F-08 | Medium | Comments have no report/remove path; `hidden` column unreachable | Open |
| F-09 | Medium | Account enumeration via `409 email_taken` | Accepted |
| F-10 | Medium | No email verification (any address can be claimed) | Accepted |
| F-11 | Low | CSRF relies on `Origin` + `SameSite=Lax`, no tokens | Accepted |
| F-12 | Low | No enforced lint/type gate; `npm audit` unchecked | Open |
| F-13 | Low | `deploy` user in `docker` group = root-equivalent | Accepted |
| F-14 | Low | No disclosure policy / 2FA / branch protection on the repo | Partly fixed |
| F-15 | Info | HSTS `preload` set — hard to undo | Note |
| F-16 | Info | Bot Fight Mode challenges non-browser API clients | Note |

---

## F-01 — Wallet front-end not implemented (High, expected)

`lib/market.ts` is demo data. No wagmi/viem, no approval flow, no transaction UI. The
highest-risk surface in the product does not exist yet — good for today, and the main
thing to get right next.

Mandatory when it lands:

- exact-amount approvals or Permit2 — **never** `type(uint256).max`
- contract address and chain id shown before signing, read from env not hardcoded
- EIP-712 typed intents so a signature cannot be replayed
- **no third-party script in the signing flow**; pinned deps, SRI, explicit
  `connect-src` in the CSP (done)
- a drainer test: connect a throwaway wallet to production and confirm the approval
  payload matches what the UI claims

## F-02 — Contract trust model (High, blocks mainnet)

Facts: no owner, no proxy, no upgrade path, no fee function, no admin over user funds.
The only privileged action is `proposeResolution(bool, bytes32)`, with a 72-hour
timelock and permissionless `finalizeResolution()`. `voidMarket()` after
`deadline + 30d` returns 0.5 per share to everyone, permissionlessly — an absent or
hostile resolver cannot trap funds. `solvencyGap() >= 0` is asserted in every test.

Residual risk, plainly:

1. **A wrong resolution is irreversible.** One key decides whether the goat burned.
   It cannot steal directly, but it can pay the wrong side.
2. No independent audit. The 17 tests cover paths I thought of; an adversary finds
   the ones I did not.
3. Testnet resolver == deployer EOA. **Mainnet must be a Safe**, address published.

Before real money: independent review, resolver as 3-of-5 Safe, and a
`MAX_TOTAL_VALUE` cap in the constructor to bound the blast radius of any defect.

## F-03 — Nothing is backed up (High)

`pgdata` (users, sessions, recovery codes, comments) and `notify.jsonl` live on named
volumes. They survive container rebuilds but **not** a lost VPS, and no restore has
ever been attempted. A backup you have not restored is not a backup.

Required: nightly `pg_dump` + copy of `notify.jsonl` off-box, plus one documented
restore drill.

## F-04 — CSP weakens to `'unsafe-inline'` (Medium, accepted with evidence)

Measured on production: the HTML contains **32 `<script>` tags and only 3 carried a
nonce**. With `script-src 'nonce-…' 'strict-dynamic'` browsers ignore `'self'`, so the
six hydration chunks were blocked — the page rendered and never became interactive.
`'strict-dynamic'` was the mistake; it disables host allowlists.

Current policy is `script-src 'self' 'unsafe-inline'`. It still blocks third-party
script origins (the main wallet-drainer vector), framing, object/embed, base-uri and
form-action hijacking. It does **not** mitigate inline XSS.

Exposure today is low: React escapes all interpolated text, and the only
`dangerouslySetInnerHTML` is build-time JSON-LD. Tighten when the wallet layer lands.

## F-05 — Rate limiting is weaker than it looks (Medium)

`createLimiter` is an in-process `Map`: resets on deploy, per-container, bypassed by
distributing requests. A speed bump, not a control.

**Cloudflare rate rules for `/api/auth/*` were never actually created** — they are a
step in the setup doc, not a fact. Verify in the dashboard before launch. Without it,
credential stuffing against `/api/auth/login` is limited only by 8 attempts/minute per
process.

## F-06 — No CI (Medium)

Tests exist (`forge test` + four Python suites) but nothing runs them on commit. A
change can reach production with a failing suite. No `npm audit`, no Dependabot.

## F-07 — Secrets on the workstation (Medium, partly fixed)

`.env.deploy` holds the server root password, the deployer private key,
`POSTGRES_PASSWORD` and `SESSION_SECRET`. Gitignored and verified ignored, but
plaintext on a laptop — and the root password was once pasted into a chat.

Fixed: SSH is now key-only, so the password is dead weight and should be deleted.
Partly fixed: the deployer key is testnet-only. Mainnet needs a hardware wallet, and
the pepper belongs in a real secret store.

## F-08 — Comments have no moderation escape hatch (Medium)

`moderate()` is a word list plus link/caps/length rules — a speed bump. A `hidden`
column exists with **no code path to set it**: not even the operator can remove a
comment without SQL. For a public comment box on an open-source project that is a
foreseeable incident.

Minimum before launch: a documented SQL/CLI procedure or an admin route behind a
separate secret, a report button, and a stated retention period in the privacy page.

## Accepted risks, with reasoning

- **F-09 enumeration.** `register` returns `409 email_taken`, so an attacker can test
  whether an address has an account. Fixing it properly means emailing a "you already
  have an account" notice — impossible here. A small enumeration leak beats a
  confusing signup dead end.
- **F-10 no email verification.** Anyone can register with any address. Harm is
  limited because **no mail is ever sent** to it, so nothing can be impersonated. It
  does mean "verified email" means nothing.
- **F-11 no CSRF tokens.** `SameSite=Lax` blocks cross-site POSTs in every current
  browser, and every mutating route also compares `Origin` to `Host`. Tokens would be
  defence in depth, not a live gap.
- **F-13 docker group.** `deploy` can `docker run -v /:/host` and become root. That is
  inherent to Docker; the real control is that only key-holders can log in at all.


## What is done right (verified, not assumed)

| Control | Evidence |
|---|---|
| SSH key-only, root password disabled | password login returns `Authentication failed` |
| Firewall | ufw: 22/80/443 in, everything else denied |
| Brute force | fail2ban sshd jail, 4 tries → 1h ban |
| Patching | unattended-upgrades active |
| TLS | Cloudflare origin cert (valid to 2041), HSTS preload, TLS 1.2+ |
| Containers | non-root `nextjs`, `no-new-privileges`, DB port never published |
| Passwords | scrypt N=2¹⁵, per-hash salt, `timingSafeEqual`, dummy hash for unknown users |
| Sessions | 32-byte tokens, **only SHA-256 stored**, `__Host-` prefix, HttpOnly/Secure/Lax |
| Recovery codes | 80-bit, HMAC-peppered server-side, single use, fail-closed |
| Account deletion | cascades to sessions, recovery codes, comments — verified live |
| Timing | login and recover do equal work for unknown accounts |
| Contract | no owner, no fee, no upgrade, void escape hatch, solvency asserted |
| Tests | 17 contract · 13 auth · 15 recovery · 14 comments — all passing |
| Config hygiene | CRLF eliminated, `.gitattributes` enforces LF, secrets gitignored |

## Open-source readiness — go / no-go

**Can go public now** (code, README, this audit). Publishing is a trust *increase*:
the contract is already non-custodial, and hiding it hides nothing from an attacker.

**Must be fixed before the site holds real money:**

- [ ] F-02 independent contract review, findings closed
- [ ] F-02 resolver = 3-of-5 Safe, address published on `/rules`
- [ ] F-02 `MAX_TOTAL_VALUE` cap set in the constructor
- [ ] F-03 nightly backups **and one tested restore**
- [ ] F-05 Cloudflare rate rules on `/api/auth/*` verified in the dashboard
- [ ] F-08 a working way to remove a comment
- [ ] F-06 CI running `forge test` + the Python suites on every push
- [ ] F-01 wallet layer reviewed against the drainer checklist

**Before or shortly after going public:**

- [ ] F-07 delete `SERVER_ROOT_PASSWORD`, move `SESSION_SECRET` to a secret store
- [ ] F-12 `npm audit` in CI, Dependabot enabled
- [ ] F-14 2FA on GitHub, branch protection on `main`, `SECURITY.md` with a
      disclosure address that actually receives mail
- [ ] A `LICENSE` file — without one the code is "all rights reserved" and nobody may
      legally reuse it, which defeats the point

## Re-running this review

```bash
npm.cmd run build                       # type + lint gate
cd contracts && forge test              # 17 contract tests
python scripts/test_auth.py             # 13
python scripts/test_recovery.py         # 15
python scripts/test_comments.py         # 14
curl -sI https://willthegavlegoatburn.com | grep -i content-security-policy
```

