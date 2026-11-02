# Scripts

Everything here is a plain script. The only third-party import is `paramiko`
(SSH) — `pip install paramiko` is the whole dependency list.

## Deploying and operating

| Script | What it does |
|---|---|
| `deploy.py` | the one-command deploy: tar → upload → `docker compose build` → `up -d` → validates Caddy → smoke-checks the RPC. `--no-build` for config-only changes. |
| `remote.py` | the SSH helper `deploy.py` uses, plus a way to run one command on the box: `python scripts/remote.py "docker compose ps"`. |
| `setup_db.py` | one-shot Postgres credential provisioning; writes the password to `.env.deploy` and the server's `.env.local`. Idempotent. |
| `backup_db.sh` | nightly `pg_dump` into `/var/backups/gavle`, 14 kept, `gunzip -t` verified. Installed as `gavle-backup.timer` (`docs/RUNBOOK.md`). |
| `diag-db.sh` | quick table list + row counts from the live database. |
| `verify-certs.sh` | fixes ownership/permissions on the Cloudflare origin certificate after a copy. |
| `seed-book.html` | browser tool that seeds the order book from your own wallet (approve → deposit → split → 2 asks + 2 bids), and unwinds it all again. `docs/ORDERBOOK.md`. |

## Deploying the contracts

| Script | What it does |
|---|---|
| `deploy_book.py` | deployed the **live** CLOB (`GavleGoatMarket` at `0xcfa2…880f`). Base mainnet. |
| `deploy_contract.py` | earlier deploy wrapper for the same contract, with simulate/resume. `docs/DEPLOY_CONTRACT.md` still refers to it. |
| `deploy_mainnet.py` | deployed the AMM backstop and seeded it with 10.88 USDC. **Not used by the site** — see `docs/ORDERBOOK.md`. |
| `devnet.py` | a local devnet: real EVM, real transactions, no faucets. |
| `fork_test.py` | end-to-end contract test against a local fork of Base mainnet. |

`deploy_book.py` and `deploy_contract.py` overlap; the former is what actually
deployed the live market, so do not delete it until the two are consolidated.

## Tests (run against a live deployment)

| Script | What it covers |
|---|---|
| `test_auth.py` | full account lifecycle: register, login, password change, delete |
| `test_recovery.py` | recovery codes: single use, wrong code, session invalidation |
| `test_comments.py` | posting, moderation, cascade on account delete |
| `test_notify.py` | the maintenance-page email capture (JSONL) |

```bash
python scripts/test_auth.py            # defaults to https://willthegavlegoatburn.com
```

They create and delete their own accounts; do not point them at a database you
care about.
