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
    "node_modules", ".next", ".git", ".tools", ".env.deploy", ".env.local", "certs",
    "_deploy.tar.gz", "app.tar.gz", "out", "cache", "coverage", "__pycache__", "broadcast",
}


def make_tarball() -> None:
    if TARBALL.exists():
        TARBALL.unlink()

    # Compose reads infra/.env for build-arg interpolation. NEXT_PUBLIC_* values are
    # public by definition, so writing them into the tarball is safe.
    local_env = ROOT / ".env.local"
    if local_env.exists():
        public = [
            line
            for line in local_env.read_text(encoding="utf-8").splitlines()
            if line.startswith("NEXT_PUBLIC_")
        ]
        (ROOT / "infra" / ".env").write_text("\n".join(public) + "\n", encoding="utf-8", newline="\n")
        print(f"build env: {len(public)} NEXT_PUBLIC_ values")

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
            # tar -x only adds and overwrites; it never deletes. Without this the
            # server keeps building files that were deleted locally (a removed
            # page stays live forever). Only code dirs are removed — .env.local,
            # infra/certs and data are preserved.
            f"cd {REMOTE_DIR} && rm -rf app components lib docs scripts contracts",
            f"cd {REMOTE_DIR} && tar -xzf _deploy.tar.gz && rm -f _deploy.tar.gz",
            f"chown -R deploy:deploy {REMOTE_DIR}",
        ]
        if not no_build:
            steps.append(
                f"cd {REMOTE_DIR}/infra && docker compose build 2>&1 | tail -3"
            )
        steps += [
            f"cd {REMOTE_DIR}/infra && docker compose up -d --remove-orphans",
            # The Caddyfile is a bind mount, so compose never recreates Caddy when only
            # that file changes: the container keeps serving its old config (and even its
            # old inode) forever. Validate the NEW file in a throwaway container first —
            # a bad config would otherwise crash-loop and take the whole site down — then
            # restart so the new file is actually mounted.
            f"docker run --rm -v {REMOTE_DIR}/infra/Caddyfile:/c/Caddyfile "
            f"-v {REMOTE_DIR}/infra/certs:/certs caddy:2-alpine "
            f"caddy validate --adapter caddyfile --config /c/Caddyfile >/dev/null 2>&1 "
            f"&& docker restart gavle-caddy >/dev/null "
            f"|| echo 'WARN: Caddyfile invalid — old config left running'",
            "sleep 4",
            f"docker compose -f {REMOTE_DIR}/infra/docker-compose.yml ps",
            # A silent build-arg failure once shipped an image with an empty
            # NEXT_PUBLIC_RPC_URL: the site served fine while every read failed.
            # Fail the deploy instead of discovering it from the browser.
            "docker exec gavle-web wget -qO- http://127.0.0.1:3000/api/orders 2>/dev/null "
            "| grep -q 'rpc_unavailable' "
            "&& { echo 'FAIL: app cannot reach the RPC (check NEXT_PUBLIC_RPC_URL build arg)'; exit 1; } "
            "|| echo 'app RPC check ok'",
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
