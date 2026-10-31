#!/usr/bin/env python3
"""
Minimal SSH runner for this project.

    python scripts/remote.py "uname -a; whoami"
    python scripts/remote.py --file some-script.sh
    python scripts/remote.py --key "docker ps"

Credentials come from .env.deploy (gitignored). Once the SSH key is installed,
password auth is disabled on the server and only the key is used.
"""
from __future__ import annotations

import sys
from pathlib import Path

import paramiko

# Server output is UTF-8 (systemd prints arrows and similar); Windows consoles are
# cp1252 by default, which raised UnicodeEncodeError mid-deploy and swallowed the
# exit code. Reconfigure rather than hope every command is ASCII-only.
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except (AttributeError, ValueError):
        pass

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env.deploy"
KEY_FILE = Path.home() / ".ssh" / "gavle_deploy"


def load_env(path: Path) -> dict[str, str]:
    cfg: dict[str, str] = {}
    if not path.exists():
        return cfg
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        cfg[k.strip()] = v.strip()
    return cfg


def connect(cfg: dict[str, str], force_password: bool = False) -> paramiko.SSHClient:
    host = cfg["SERVER_HOST"]
    user = cfg.get("SERVER_ROOT_USER", "root")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    if KEY_FILE.exists() and not force_password:
        client.connect(
            host,
            username=user,
            key_filename=str(KEY_FILE),
            timeout=25,
            allow_agent=False,
            look_for_keys=False,
        )
    else:
        client.connect(
            host,
            username=user,
            password=cfg["SERVER_ROOT_PASSWORD"],
            timeout=25,
            allow_agent=False,
            look_for_keys=False,
        )
    return client


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 900) -> int:
    transport = client.get_transport()
    if transport is not None:
        transport.set_keepalive(15)
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    rc = stdout.channel.recv_exit_status()
    if out:
        sys.stdout.write(out if out.endswith("\n") else out + "\n")
    if err.strip():
        sys.stderr.write(err if err.endswith("\n") else err + "\n")
    return rc


def main() -> int:
    args = sys.argv[1:]
    force_password = "--password" in args
    args = [a for a in args if a != "--password"]

    cfg = load_env(ENV_FILE)
    if not cfg.get("SERVER_HOST"):
        print("No SERVER_HOST in .env.deploy", file=sys.stderr)
        return 2

    if args and args[0] == "--file":
        cmd = Path(args[1]).read_text(encoding="utf-8")
    elif args and args[0] == "--put":
        local, remote = Path(args[1]), args[2]
        client = connect(cfg, force_password)
        sftp = client.open_sftp()
        with sftp.file(remote, "wb") as fh:
            fh.write(local.read_bytes())
        sftp.close()
        client.close()
        print(f"uploaded {local} -> {remote}")
        return 0
    elif args:
        cmd = " ".join(args)
    else:
        cmd = "hostname; whoami; uname -sr"

    client = connect(cfg, force_password)
    try:
        rc = run(client, cmd)
    finally:
        client.close()
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
