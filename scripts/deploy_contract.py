#!/usr/bin/env python3
"""
Deploy GavleGoatMarket.

    python scripts/deploy_contract.py              # simulate only (no gas, no tx)
    python scripts/deploy_contract.py --broadcast   # actually deploy + verify

Reads everything from .env.deploy. The private key is passed through the child
process environment, never on the command line, and is never printed.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from remote import load_env  # noqa: E402

# Windows consoles default to cp1252, which cannot encode forge's box-drawing
# output or the arrows below.
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

ROOT = Path(__file__).resolve().parent.parent
CONTRACTS = ROOT / "contracts"
FORGE = ROOT / ".tools" / "foundry" / "forge.exe"
REQUIRED = [
    "DEPLOYER_PRIVATE_KEY",
    "USDC_ADDRESS",
    "RESOLVER_ADDRESS",
    "BETTING_CLOSES_AT",
    "RESOLUTION_DEADLINE",
    "RPC_URL",
]


def write_env_local(address: str) -> None:
    path = ROOT / ".env.local"
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    key = "NEXT_PUBLIC_MARKET_ADDRESS="
    out, replaced = [], False
    for line in lines:
        if line.startswith(key):
            out.append(f"{key}{address}")
            replaced = True
        else:
            out.append(line)
    if not replaced:
        out.append(f"{key}{address}")
    path.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"\n.env.local updated: {key}{address}")


def main() -> int:
    broadcast = "--broadcast" in sys.argv
    cfg = load_env(ROOT / ".env.deploy")

    missing = [k for k in REQUIRED if not cfg.get(k)]
    if missing:
        print(f"Missing in .env.deploy: {', '.join(missing)}", file=sys.stderr)
        return 2

    if not FORGE.exists():
        print(f"forge not found at {FORGE}", file=sys.stderr)
        return 2

    env = os.environ.copy()
    for k in REQUIRED:
        env[k] = cfg[k]

    cmd = [str(FORGE), "script", "script/Deploy.s.sol", "--rpc-url", cfg["RPC_URL"], "-vv"]
    if broadcast:
        cmd.append("--broadcast")
        if cfg.get("BASESCAN_API_KEY"):
            cmd += ["--verify", "--verifier", "etherscan",
                    "--etherscan-api-key", cfg["BASESCAN_API_KEY"]]

    print(f"{'BROADCAST' if broadcast else 'SIMULATE '} → {cfg['RPC_URL']}")
    print(f"deployer: {cfg.get('DEPLOYER_ADDRESS', '(unknown)')}\n")

    proc = subprocess.run(cmd, cwd=CONTRACTS, env=env, capture_output=True, text=True)
    output = (proc.stdout or "") + (proc.stderr or "")
    print(output[-5000:])

    match = re.search(r"GavleGoatMarket deployed at:\s*(0x[0-9a-fA-F]{40})", output)
    if broadcast and match:
        write_env_local(match.group(1))
    elif broadcast:
        print("Deployed, but could not parse the address from output.", file=sys.stderr)

    return proc.returncode


if __name__ == "__main__":
    raise SystemExit(main())
