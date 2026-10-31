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

## Not implemented yet (deliberately)

- **Email verification.** Needs a mail provider. Until then an address is unverified
  but still usable.
- **Password reset by email.** Same blocker. A reset flow without verified delivery
  is a takeover vector, so it is better absent than half-built. The login page says
  so explicitly and points at "delete account and re-register".

Both are ~30 lines once `MAIL_API_KEY` exists: a `tokens` table, a route that always
answers `ok:true` (no account enumeration), and a single templated email.

## Inspecting

```bash
# who exists (emails only)
ssh deploy@148.135.185.56 "docker exec gavle-db psql -U gavle -d gavle -tAc 'select email, created_at from users'"

# sessions per user
ssh deploy@148.135.185.56 "docker exec gavle-db psql -U gavle -d gavle -tAc \
  'select u.email, count(s.*) from users u left join sessions s on s.user_id=u.id group by 1'"
```

Back up the volume like the notify list — `pgdata` is not in `backup.sh` yet.
