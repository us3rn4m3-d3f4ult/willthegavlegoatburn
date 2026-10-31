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

    client = connect(cfg)
    try:
        script = (
            "cd /home/deploy/gavle && "
            f"grep -v '^POSTGRES_PASSWORD=' .env.local > .env.local.new; "
            f"printf '%s\\n' 'POSTGRES_PASSWORD={password}' >> .env.local.new; "
            f"grep -v '^DATABASE_URL=' .env.local.new > .env.local.new2; "
            f"printf '%s\\n' 'DATABASE_URL={database_url}' >> .env.local.new2; "
            "mv .env.local.new2 .env.local && rm -f .env.local.new && "
            "chown deploy:deploy .env.local && "
            "grep -c '^DATABASE_URL=.*@postgres:5432' .env.local"
        )
        rc = run(client, script)
    finally:
        client.close()

    return rc


if __name__ == "__main__":
    raise SystemExit(main())
