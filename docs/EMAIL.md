# Email

One job: confirm that an address belongs to the person who typed it. There is no
password reset by email — recovery codes handle that — so this is only about
proving ownership.

## It is optional by design

`lib/mail.ts` reads `RESEND_API_KEY` and `MAIL_FROM`. When the key is blank:

- registration works exactly as before,
- accounts are simply unverified,
- **nothing is gated on verification** — the discussion stays open,
- `/account` shows no "confirm your email" panel, because there is no link to send.

Set the key and the whole flow switches on: new signups get a verification email,
`/account` shows a resend panel, and existing accounts can confirm whenever they
like.

## Two switches, on purpose

| Env | Means |
|---|---|
| `RESEND_API_KEY` | We *can* send. Turns on signup emails and the `/account` panel. |
| `REQUIRE_VERIFIED_EMAIL=1` | We *require* it. Unverified accounts cannot post comments (403 `verify_email`). |

They are separate because a key can exist while the sending domain is still
pending at Resend. Gating on the key alone would lock everyone out of the
discussion with no way to confirm. **Only set `REQUIRE_VERIFIED_EMAIL=1` after a
test email actually arrives.**

## Turning it on

1. **Resend** (free tier: 3,000/month): create an account → **Domains** → add
   `willthegavlegoatburn.com` → add the DKIM/SPF records it shows in Cloudflare,
   **DNS only** (grey cloud). Verify.
2. **API Keys** → create one with *sending* permission.
3. Put both in `.env.local` (and on the server):
   ```
   RESEND_API_KEY=re_...
   MAIL_FROM=willthegavlegoatburn <noreply@willthegavlegoatburn.com>
   ```
4. Redeploy — these are read at runtime, so no rebuild of `NEXT_PUBLIC_*` style
   build args is needed, but the container must be recreated (`docker compose up -d`)
   so `env_file` is re-read.

Postmark works the same way with a different URL — swap the `fetch` in
`lib/mail.ts`. Read `docs/SETUP.md` §3 first: its DNS guidance (Return-Path CNAME,
DMARC) is what keeps verification mail out of spam, and verification mail in spam
looks exactly like a broken site.

## Flow

| Piece | Where |
|---|---|
| Token issue (SHA-256 stored, 24h, one live token per account) | `issueToken()` in `lib/mail.ts` |
| The link (`GET /api/auth/verify?token=…`) | `app/api/auth/verify/route.ts` → sets `email_verified_at`, redirects to `/account?verified=1` |
| Resend (3/hour per account) | `app/api/auth/verify/resend/route.ts` |
| Banner on `/account` | `components/VerifyEmail.tsx` |
| Gate on commenting | `app/api/comments/route.ts` (`VERIFY_REQUIRED && !user.emailVerifiedAt`) |

A verification link is single-use, expires in 24 hours, and is replaced whenever a
new one is issued. It is a GET because it arrives in an email and the action is not
destructive.

## Enumeration

`POST /api/auth/register` with an address that already has an account returns
`{ ok: true, pending: true }` when mail is configured — identical in shape to a
success — and sends the owner a "someone tried to sign up with your email" note.
Without mail configured it has to answer `409 email_taken`, because otherwise the
person has no way to learn they should sign in instead. That trade-off is
deliberate, and it disappears the moment the key is set.
