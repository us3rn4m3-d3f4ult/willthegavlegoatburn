# Accounts

Email + password accounts. **An account is a profile, never a wallet** — no session
can move funds, every trade needs a wallet signature.

## Storage

Postgres 16 in Compose (`gavle-db`), no published ports, data on the `pgdata`
volume. Two tables, created automatically on first request (`lib/db.ts`):

```sql
users     (id uuid pk, email text unique, password_hash text, created_at timestamptz)
sessions  (token_hash text pk, user_id uuid → users on delete cascade,
           created_at, last_seen, user_agent, ip)
```

## Passwords

`scrypt` from `node:crypto` — no native module to compile, no dependency to patch.
N=2^15, r=8, p=1, 64-byte key, 16-byte random salt. Stored as:

```
scrypt$32768$8$1$<base64 salt>$<base64 key>
```

Parameters live in the string, so they can be raised later without invalidating
existing hashes. Verification uses `timingSafeEqual`. Login on a nonexistent
account still runs a dummy hash so response timing does not reveal whether an email
is registered.

## Sessions

- 32 random bytes, base64url, sent as `__Host-gsess` (production) — `HttpOnly`,
  `Secure`, `SameSite=Lax`, `Path=/`, 30 days.
- **Only the SHA-256 of the token is stored.** A database leak does not yield usable
  session cookies.
- Sliding expiry: `last_seen` updates on each authenticated request.
- Changing the password deletes **every** session for that user and issues one new
  one.
- Deleting the account cascades to all sessions instantly.

## Endpoints

| Route | Behaviour |
|---|---|
| `POST /api/auth/register` | creates user, starts session. `409 email_taken` on duplicate |
| `POST /api/auth/login` | `401 invalid_credentials` for both wrong email and wrong password |
| `POST /api/auth/logout` | deletes the session row, clears the cookie |
| `GET /api/auth/me` | `{ user, sessions }`, `user: null` when signed out |
| `POST /api/auth/account` | `{action:"password"}` or `{action:"delete", confirm:"DELETE"}` — both require the current password |

Rate limits (per IP, per process): register 10/min, login 8/min, account changes
6/min. Cloudflare rate rules sit in front of these.

All mutating routes also check the `Origin` header against `Host`.

## Deletion is real

`delete from users` — no soft delete, no tombstone, no email retained. This is what
the privacy statement promises, so it has to stay true.

## Recovery codes (the only way back in)

There is no password-reset email — this server cannot send mail (see
`docs/EMAIL.md`). Recovery happens with **10 one-time codes**, issued at
registration and shown exactly once.

- 16 characters from a 32-symbol alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, no
  I/O/0/1) = **80 bits**, formatted `XXXX-XXXX-XXXX-XXXX`.
- Stored as `HMAC-SHA256(SESSION_SECRET, normalised_code)`. The pepper lives in the
  environment, not the database, so a database dump alone cannot be used to reset an
  account.
- Single use: `used_at` is set on consumption, and a used code is indistinguishable
  from a wrong one.
- 5 attempts/minute per IP — this endpoint is password-equivalent.
- A successful recovery **destroys every session**, because whoever held one may be
  the person who took the account.
- "Generate new codes" on `/account` (requires the current password) replaces the
  whole set and invalidates the old one.

⚠️ **`SESSION_SECRET` must never be rotated casually.** It peppers the code hashes;
changing it silently invalidates every code ever issued. `scripts/setup_db.py` only
ever writes it if the value is empty.

## Still missing

- **Email verification.** Needs a mail provider. Addresses are unverified but usable.
  This is a deliberate trade, not an oversight.

## A gotcha that has bitten twice

`.env.example` ships keys with **empty values** (`DATABASE_URL=`,
`SESSION_SECRET=`, …). Any "add if missing" provisioning logic will see the key,
assume it is configured, and skip it — which is exactly how `DATABASE_URL` ended up
pointing at `localhost` and `SESSION_SECRET` ended up as a single `\r`. Provisioning
must **upsert**, and `.gitattributes` now forces LF so the `\r` cannot come back.

## Inspecting

```bash
# who exists (emails only)
ssh deploy@148.135.185.56 "docker exec gavle-db psql -U gavle -d gavle -tAc 'select email, created_at from users'"

# sessions per user
ssh deploy@148.135.185.56 "docker exec gavle-db psql -U gavle -d gavle -tAc \
  'select u.email, count(s.*) from users u left join sessions s on s.user_id=u.id group by 1'"
```

Back up the volume like the notify list — `pgdata` is not in `backup.sh` yet.
