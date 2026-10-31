# Setup — from bare server to live site

Everything below is ordered. Steps 1 and 3 have waiting periods (DNS, propagation),
so start them first and fill the gaps with step 4.

---

## 1. Server (`148.135.185.56`, Ubuntu 24.04)

### 1.1 Add your SSH key — do this before anything else

From your laptop:

```powershell
ssh-keygen -t ed25519 -C "gavle-deploy"        # skip if you already have a key
type $HOME\.ssh\id_ed25519.pub | ssh root@148.135.185.56 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

### 1.2 Run the hardening script

```bash
ssh root@148.135.185.56
# paste infra/harden.sh onto the box, or:
curl -fsSL https://raw.githubusercontent.com/<you>/willthegavlegoatburn/main/infra/harden.sh -o harden.sh
bash harden.sh
```

What it does: 2 GB swap · `deploy` user with your key · **disables root password
login and password auth entirely** · ufw (22/80/443 only) · fail2ban ·
unattended-upgrades · Docker.

It refuses to run the SSH hardening step unless a key is already present, so it
cannot lock you out.

> After this, `SERVER_ROOT_PASSWORD` in `.env.deploy` is dead. Delete the line.

### 1.3 Deploy the app

```bash
ssh deploy@148.135.185.56
git clone <your-repo> ~/gavle && cd ~/gavle
cp .env.example .env.local     # fill in what exists so far
mkdir -p infra/certs
cd infra && docker compose up -d --build
docker compose logs -f caddy
```

`web` publishes no ports at all — only Caddy can reach it.

---

## 2. Cloudflare — the "cloudflare thing", step by step

> **Status as of 30 Oct 2026:** the domain is already registered and already on
> Cloudflare nameservers (`alexia.ns` / `logan.ns.cloudflare.com`). **Skip 2.1–2.4.**
> Only the DNS records (2.5) and TLS mode (2.6) are outstanding.

### 2.1 If you have not bought the domain yet

Cloudflare Dashboard → **Domain Registration → Register Domains** → search
`willthegavlegoatburn.com` → buy it (sold **at cost**, ~$10.44/yr for .com).
Buying it *at Cloudflare* skips steps 2.3–2.4 completely.

### 2.2 If you already own it

Keep it where it is for now — you do not need to transfer it. Just repoint the
nameservers in 2.4.

### 2.3 Add the site to Cloudflare

1. **Add a site** → `willthegavlegoatburn.com` → plan: **Free**.
2. Cloudflare scans existing DNS and then shows you **two nameservers**, e.g.
   `ada.ns.cloudflare.com` and `bob.ns.cloudflare.com`.

### 2.4 Point the nameservers (this is the actual "Cloudflare thing")

Go to **the registrar where the domain currently lives** → domain settings →
**Nameservers / DNS servers** → replace whatever is there with Cloudflare's two →
save.

- Usually active in **minutes**, up to **24h**. Cloudflare emails you when it's live.
- Don't change anything else at the registrar.
- Leave the domain **unlocked after setup? No** — turn registrar lock **on**, plus
  hardware-key 2FA on the registrar account. Domain hijack is the #1 way
  non-custodial users get phished in your name.

### 2.5 DNS records

**Phase 1 — get the certificate first (proxy OFF):**

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` | `148.135.185.56` | **DNS only** (grey) |

Wait ~60s, then restart Caddy: `docker compose restart caddy`. It issues a Let's
Encrypt cert over plain HTTP-01 with nothing in the way. Confirm in
`docker logs gavle-caddy | grep -i certificate`.

**Phase 2 — now turn the proxy on:**

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` | `148.135.185.56` | **Proxied** (orange) |
| CNAME | `www` | `willthegavlegoatburn.com` | **Proxied** (orange) |

> ⚠️ The CNAME target must be the **full hostname including `.com`**. Typing
> `willthegavlegoatburn` makes Cloudflare return **530 (Origin DNS error)** on
> `www.` while the apex keeps working — a confusing half-broken state.

Then do 2.6 (SSL mode + Always Use HTTPS).

**What actually happened on this deployment:** the A record was proxied from the
start, so Let's Encrypt HTTP-01 could never complete — Cloudflare terminates and
redirects the challenge before it reaches the origin, and the site returned
**525 SSL Handshake Failed** until a Cloudflare Origin Certificate was installed.
That is exactly the failure mode the two phases above exist to avoid.

No `AAAA` record — the box has no IPv6.

---

### 2.6 TLS

Set **SSL/TLS → Overview → Full (strict)**.

The origin uses a **Cloudflare Origin Certificate**, installed at
`infra/certs/origin.pem` + `origin.key` on the server (gitignored, mode 600, valid
to 2041, covering the apex and `*.willthegavlegoatburn.com`). It is signed by
Cloudflare's own Origin CA, so Full (strict) is satisfied and there is no renewal
to manage.

Caddy refuses to start if those files are missing — intentional, so a missing
certificate can never silently downgrade the site to HTTP. Regenerate at
**SSL/TLS → Origin Server → Create Certificate** and re-upload both files.

Then **SSL/TLS → Edge Certificates**: Always Use HTTPS **on** · HSTS **on**
(start at 6 months; raise to 1 year + preload once you're sure) · Minimum TLS
**1.2** · TLS 1.3 **on**.

> Don't want Cloudflare proxying? Set the A record to **DNS only** (grey). Caddy
> still gets its cert over HTTP-01. Your origin IP becomes public, which is why
> proxying is better.


### 2.7 Edge protection

- **Security → Bots → Bot Fight Mode: on**
- **Security → WAF → Rate limiting rules:** `/login*`, `/forgot-password*`,
  `/register*` → 10 requests / 1 min per IP.
- **Security → Settings → Under Attack Mode** stays off; use it only during an attack.

---

## 3. Email — `contact@` plus a sender for verification/reset

Two separate jobs. Keep them separate or the DNS records fight each other.

### 3.1 `contact@willthegavlegoatburn.com` — inbound, free

Cloudflare → **Email → Email Routing** → Enable → add destination address (your
personal inbox) → verify it → **Create address** `contact` → forwards to you.
Cloudflare adds the MX + SPF records itself. No mailbox to maintain.

### 3.2 Sender for transactional mail — pick one

| Provider | Free tier | Notes |
|---|---|---|
| **Postmark** | 100 emails/mo | Best deliverability. Needs no MX — it uses a Return-Path CNAME, so it coexists with Email Routing cleanly. **Recommended.** |
| **Resend** | 3,000/mo | Great DX. Add it on the **`send.` subdomain** so its MX doesn't collide with Email Routing. |
| Amazon SES | 62k/mo from EC2 | Cheapest, most setup, easiest to get throttled while sandboxed. |

Setup for Postmark:
1. Create account → **Servers → Default → Sender Signatures** → add domain.
2. It gives you **DKIM** (two CNAMEs) and a **Return-Path CNAME**.
3. Add all three in Cloudflare DNS, **DNS only** (grey).
4. Verify → create a **Server API token** → put it in `.env.local` as `RESEND_API_KEY`
   (or rename to `MAIL_API_KEY` when the API is wired).

### 3.3 DMARC — one record, big payoff

Cloudflare DNS → add **TXT**:

```
Name:  _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:contact@willthegavlegoatburn.com; pct=100; adkim=r; aspf=r
```

Without this, password-reset mail lands in spam — and reset mail in spam means
people think your site is broken.
