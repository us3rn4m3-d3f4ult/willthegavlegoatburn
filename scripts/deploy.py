#!/usr/bin/env python3
"""
One-command deploy: tar the repo, upload it, rebuild the container, restart.

    python scripts/deploy.py
    python scripts/deploy.py --no-build      # config-only change (e.g. Caddyfile)

Excludes node_modules, .next, .git, .env.deploy, certs and tarballs. Never sends
secrets: .env.local lives on the server and is not overwritten.
"""
from __future__ import annotations

import subprocess
import sys
import tarfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from remote import connect, load_env, run  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
REMOTE_DIR = "/home/deploy/gavle"
TARBALL = ROOT / "_deploy.tar.gz"
SKIP = {
    "node_modules", ".next", ".git", ".env.deploy", ".env.local", "certs",
    "_deploy.tar.gz", "app.tar.gz", "out", "coverage", "__pycache__",
}


def make_tarball() -> None:
    if TARBALL.exists():
        TARBALL.unlink()
    with tarfile.open(TARBALL, "w:gz") as tar:
        for p in sorted(ROOT.rglob("*")):
            rel = p.relative_to(ROOT)
            if any(part in SKIP for part in rel.parts):
                continue
            if p.is_file():
                tar.add(p, arcname=str(rel))
    print(f"tarball : {TARBALL.stat().st_size / 1024:.0f} KB")


def main() -> int:
    no_build = "--no-build" in sys.argv

    make_tarball()

    cfg = load_env(ROOT / ".env.deploy")
    client = connect(cfg)
    try:
        sftp = client.open_sftp()
        with sftp.file(f"{REMOTE_DIR}/_deploy.tar.gz", "wb") as fh:
            fh.write(TARBALL.read_bytes())
        sftp.close()
        print("upload  : ok")

        steps = [
            f"cd {REMOTE_DIR} && tar -xzf _deploy.tar.gz && rm -f _deploy.tar.gz",
            f"chown -R deploy:deploy {REMOTE_DIR}",
        ]
        if not no_build:
            steps.append(
                f"cd {REMOTE_DIR}/infra && docker compose build 2>&1 | tail -3"
            )
        steps += [
            f"cd {REMOTE_DIR}/infra && docker compose up -d --remove-orphans",
            "sleep 4",
            f"docker compose -f {REMOTE_DIR}/infra/docker-compose.yml ps",
        ]
        rc = 0
        for cmd in steps:
            rc = run(client, cmd)
            if rc != 0:
                print(f"FAILED: {cmd}", file=sys.stderr)
                break
    finally:
        client.close()
        if TARBALL.exists():
            TARBALL.unlink()
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
