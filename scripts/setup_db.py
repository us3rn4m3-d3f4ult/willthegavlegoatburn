#!/usr/bin/env python3
"""
One-shot database credential provisioning.

Generates a random Postgres password, writes it to .env.deploy (local) and to the
server's .env.local, without ever printing the secret. Idempotent: if a password
is already present in .env.deploy, it reuses it.

    python scripts/setup_db.py
"""
from __future__ import annotations

import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from remote import connect, load_env, run  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
LOCAL_ENV = ROOT / ".env.deploy"
REMOTE_ENV = "/home/deploy/gavle/.env.local"


def upsert(path: Path, key: str, value: str) -> str:
    """Set key=value, replacing any existing line. Returns 'added' | 'updated' | 'unchanged'."""
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    lines = existing.splitlines()
    out, seen = [], False
    for line in lines:
        if line.startswith(f"{key}=") and not seen:
            seen = True
            if line != f"{key}={value}":
                out.append(f"{key}={value}")
                continue
            out.append(line)
            continue
        out.append(line)
    if not seen:
        out.append(f"{key}={value}")
    new_text = "\n".join(out) + "\n"
    if new_text == existing:
        return "unchanged"
    path.write_text(new_text, encoding="utf-8", newline="\n")
    return "updated" if seen else "added"


def main() -> int:
    cfg = load_env(LOCAL_ENV)
    password = cfg.get("POSTGRES_PASSWORD") or secrets.token_hex(24)
    # Inside Docker Compose the database host is the service name, not localhost.
    database_url = f"postgresql://gavle:{password}@postgres:5432/gavle"

    print(f".env.deploy     POSTGRES_PASSWORD {upsert(LOCAL_ENV, 'POSTGRES_PASSWORD', password)}")
    print(f".env.deploy     DATABASE_URL      {upsert(LOCAL_ENV, 'DATABASE_URL', database_url)}")

    # Peppers the recovery-code hashes. MUST stay stable: rotating it silently
    # invalidates every issued recovery code, so it is only ever created once.
    secret = cfg.get("SESSION_SECRET") or secrets.token_hex(32)
    print(f".env.deploy     SESSION_SECRET    {upsert(LOCAL_ENV, 'SESSION_SECRET', secret)}")

    client = connect(cfg)
    try:
        script = (
            "cd /home/deploy/gavle && "
            # Normalise CRLF first: a trailing \r inside a value silently corrupts
            # it, and it already broke SESSION_SECRET once.
            "sed -i 's/\\r$//' .env.local; "
            f"grep -v '^POSTGRES_PASSWORD=' .env.local > .env.local.new; "
            f"printf '%s\\n' 'POSTGRES_PASSWORD={password}' >> .env.local.new; "
            f"grep -v '^DATABASE_URL=' .env.local.new > .env.local.new2; "
            f"printf '%s\\n' 'DATABASE_URL={database_url}' >> .env.local.new2; "
            "mv .env.local.new2 .env.local && rm -f .env.local.new && "
            # Replace an EMPTY placeholder (copied from .env.example) but never
            # overwrite a real secret — rotating it would invalidate every
            # recovery code already issued.
            f"sed -i 's|^SESSION_SECRET=$|SESSION_SECRET={secret}|' .env.local; "
            f"grep -q '^SESSION_SECRET=..*' .env.local || printf '%s\\n' 'SESSION_SECRET={secret}' >> .env.local; "
            "chown deploy:deploy .env.local && "
            "echo -n 'CRLF lines left: ' && grep -c $'\\r' .env.local || true; "
            "echo -n 'DATABASE_URL ok: ' && grep -c '^DATABASE_URL=.*@postgres:5432' .env.local && "
            "echo -n 'SESSION_SECRET chars: ' && sed -n 's/^SESSION_SECRET=//p' .env.local | head -1 | wc -c"
        )
        rc = run(client, script)
    finally:
        client.close()

    return rc


if __name__ == "__main__":
    raise SystemExit(main())
