#!/usr/bin/env python3
"""
Deploy GavleGoatAmm to Base mainnet and seed the pool with the deployer's USDC.

    python scripts/deploy_mainnet.py            # simulate only
    python scripts/deploy_mainnet.py --broadcast

Secrets come from .env.deploy and are passed through the child environment only.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from remote import load_env  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
F = ROOT / ".tools" / "foundry"
FORGE, CAST = F / "forge.exe", F / "cast.exe"

RPC = "https://mainnet.base.org"
CHAIN_ID = "8453"
USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  # native USDC on Base

for s in (sys.stdout, sys.stderr):
    try:
        s.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass


def sh(args: list[str], cwd: Path | None = None) -> str:
    p = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    out = (p.stdout or "") + (p.stderr or "")
    if p.returncode != 0:
        raise RuntimeError(f"{' '.join(args[:2])} failed:\n{out[-1200:]}")
    return out


def send_retry(args: list[str]) -> str:
    """cast send, retried while the previous tx is still pending (nonce races)."""
    last = ""
    for _ in range(6):
        try:
            return sh(args)
        except RuntimeError as exc:
            last = str(exc)
            if "replacement" in last or "nonce" in last.lower() or "already known" in last:
                time.sleep(4)
                continue
            raise
    raise RuntimeError(last)


def main() -> int:
    broadcast = "--broadcast" in sys.argv
    cfg = load_env(ROOT / ".env.deploy")
    key = cfg["DEPLOYER_PRIVATE_KEY"]
    deployer = cfg["DEPLOYER_ADDRESS"]

    # Reuse an already-deployed market instead of deploying a second one.
    existing = None
    for i, a in enumerate(sys.argv):
        if a == "--address" and i + 1 < len(sys.argv):
            existing = sys.argv[i + 1]

    eth = int(sh([str(CAST), "balance", deployer, "--rpc-url", RPC]).split()[0])
    usdc = int(sh([str(CAST), "call", USDC, "balanceOf(address)(uint256)", deployer,
                   "--rpc-url", RPC]).split()[0])
    print(f"deployer {deployer}")
    print(f"ETH   {eth / 1e18:.6f}")
    print(f"USDC  {usdc / 1e6:.6f}")

    if eth == 0 or usdc == 0:
        print("need both ETH and USDC on Base", file=sys.stderr)
        return 1

    if not broadcast:
        print("\nsimulation only - re-run with --broadcast")
        return 0

    print("\ndeploying GavleGoatAmm to Base mainnet ..." if not existing else "\nreusing deployed market ...")
    if existing:
        market = existing
    else:
        out = sh([str(FORGE), "create", "src/GavleGoatAmm.sol:GavleGoatAmm",
                  "--rpc-url", RPC, "--private-key", key, "--broadcast",
                  "--constructor-args", USDC, deployer,
                  cfg["BETTING_CLOSES_AT"], cfg["RESOLUTION_DEADLINE"]],
                 cwd=ROOT / "contracts")
        m = re.search(r"Deployed to: (0x[0-9a-fA-F]{40})", out)
        if not m:
            raise RuntimeError(f"no address in output:\n{out[-800:]}")
        market = m.group(1)
    print(f"market  {market}")

    print("approving USDC ...")
    send_retry([str(CAST), "send", USDC, "approve(address,uint256)", market, str(usdc),
                "--rpc-url", RPC, "--private-key", key])

    print(f"seeding the pool with {usdc / 1e6:.6f} USDC ...")
    send_retry([str(CAST), "send", market, "seed(uint256)", str(usdc),
                "--rpc-url", RPC, "--private-key", key])

    price = int(sh([str(CAST), "call", market, "yesPrice()(uint256)", "--rpc-url", RPC]).split()[0])
    print(f"YES price {price / 1e16:.2f}%")

    local = ROOT / ".env.local"
    lines = local.read_text(encoding="utf-8").splitlines() if local.exists() else []
    lines = [l for l in lines if not l.startswith("NEXT_PUBLIC_")]
    lines += [
        f"NEXT_PUBLIC_CHAIN_ID={CHAIN_ID}",
        f"NEXT_PUBLIC_RPC_URL={RPC}",
        f"NEXT_PUBLIC_MARKET_ADDRESS={market}",
        f"NEXT_PUBLIC_USDC_ADDRESS={USDC}",
    ]
    local.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    print(f"\n.env.local updated (NEXT_PUBLIC_MARKET_ADDRESS={market})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
