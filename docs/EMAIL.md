# Email — measured, not assumed

**Question:** can we run our own mail server and skip Mailchimp/Resend entirely?

**Answer: not from this server.** Not because of reputation — because the network
will not let the packets out. Measured on `148.135.185.56`, 30 Oct 2026, with a
working control (`1.1.1.1:443` open) so the test cannot be a false negative:

| Target | Port | Result |
|---|---|---|
| `1.1.1.1` (control) | 443 | **OPEN** |
| `gmail-smtp-in.l.google.com` | 25 | **blocked** |
| `alt4.gmail-smtp-in.l.google.com` | 25 | **blocked** |
| `mx1.mailbox.org` | 25 | **blocked** |
| `smtp.gmail.com` | 587 | **blocked** |
| `smtp.gmail.com` | 465 | **blocked** |
| `smtp-relay.brevo.com` | 587 | **blocked** |
| `smtp-relay.brevo.com` | 2525 | **blocked** |
| `smtp-relay.brevo.com` | 465 | **blocked** |
| `api.resend.com` | 443 | **OPEN** |
| `api.postmarkapp.com` | 443 | **OPEN** |

`ufw` allows all outbound traffic, so this is blocked **upstream by the hosting
provider**, not by us. Every SMTP port is closed in both directions of use:
delivering directly (25) and relaying through a provider (587/465/2525).

Two further facts, even if the port were opened tomorrow:

- **No PTR record** on the IP (`socket.gethostbyaddr` → unknown host). Most
  receivers reject or heavily downrank mail from an IP without matching reverse DNS.
- The domain is days old with zero sending history. Gmail and Microsoft filter
  brand-new sending IPs into spam as a matter of course. Password-reset mail that
  silently lands in spam is worse than no reset feature at all — the user believes
  it was sent.

## So an MTA is off the table. What is actually available:

### Option A — ask the host to unblock port 25
Some providers open it on request after account verification. Even in the best case
you then need a PTR record, SPF/DKIM/DMARC, and **weeks of warm-up** before Gmail
trusts the IP. For ~10 emails a month, this is a large operational burden with a bad
failure mode. Not recommended.

### Option B — an HTTPS email API instead of SMTP
Because HTTPS (443) works, an API-based sender is the only relay that functions on
this box. Free tiers that cover this project for years:

| Provider | Free tier | Notes |
|---|---|---|
| **Resend** | 3,000/month | $0. Best DX. Add it on a `send.` subdomain so its MX doesn't collide with Cloudflare Email Routing |
| **Postmark** | 100/month | Best deliverability; uses a Return-Path CNAME, no MX needed |
| Brevo | 300/day | Free forever, but SMTP-first |

This is "an external service", but not a paid one, and it removes the deliverability
problem entirely because you inherit their reputation.

### Option C — design email out (recommended for now)
Everything currently blocked on email can be removed instead of solved:

| Need | Without email |
|---|---|
| Email verification | Already not implemented. Drop it — accounts are unverified by design. |
| Password reset | **Recovery codes** (Stripe/GitHub style): 10 one-time codes shown once at registration. No delivery needed. |
| "Notify me when trading opens" | The countdown on `/maintenance` is already the notification. Add RSS, or a public `/announcements` page. |

Inbound mail to `contact@` is **already solved at zero cost** by Cloudflare Email
Routing (free forwarding to a personal inbox). Only *outbound* was ever the problem.

## Decision

- Do **not** run an MTA here. It cannot deliver, and pretending otherwise ships a
  broken password reset.
- ✅ **Shipped:** recovery codes, so account recovery does not depend on email at all.
  See `docs/ACCOUNTS.md`.
- If email is ever genuinely needed, use **Resend's free tier over HTTPS** — the only
  transport this network permits — and record that as an accepted dependency.

## Re-checking this later

```bash
for p in 25 587 465 2525; do
  timeout 8 bash -c "</dev/tcp/smtp.gmail.com/$p" 2>/dev/null && echo "$p open" || echo "$p blocked"
done
```
