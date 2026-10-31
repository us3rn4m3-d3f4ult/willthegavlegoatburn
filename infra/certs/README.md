# TLS certificates — NOT in git

`origin.pem` and `origin.key` are the Cloudflare **Origin Certificate** for
`willthegavlegoatburn.com` + `*.willthegavlegoatburn.com`, installed on the server
by hand. Both are gitignored (`*.pem`, `*.key`) and excluded from every deploy
tarball by `scripts/deploy.py`.

Replace them at any time:

1. Cloudflare → **SSL/TLS → Origin Server → Create Certificate**
2. Private key type RSA (2048), hostnames `willthegavlegoatburn.com` and
   `*.willthegavlegoatburn.com`, validity 15 years
3. Save the two blocks here as `origin.pem` and `origin.key`
4. `chmod 600` both, then `docker compose up -d --force-recreate caddy`

Caddy's `tls` directive points at `/certs/origin.pem`, mounted read-only from this
directory. **If these files are missing, Caddy refuses to start** — deliberate, so
a missing certificate can never silently downgrade the site to plain HTTP.

Keep an encrypted offline copy somewhere. Losing them costs five minutes and one
dashboard step; they are not wallet keys.
