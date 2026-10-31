#!/usr/bin/env python3
"""Deploy the order-book market (GavleGoatMarket) to Base mainnet."""
from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from remote import load_env  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
F = ROOT / ".tools" / "foundry"
FORGE, CAST = F / "forge.exe", F / "cast.exe"
RPC = "https://mainnet.base.org"
USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

for s in (sys.stdout, sys.stderr):
    try:
        s.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass


def sh(args: list[str], cwd: Path | None = None) -> str:
    p = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    out = (p.stdout or "") + (p.stderr or "")
    if p.returncode != 0:
        raise RuntimeError(f"{' '.join(args[:2])} failed:\n{out[-1000:]}")
    return out


def main() -> int:
    cfg = load_env(ROOT / ".env.deploy")
    key, deployer = cfg["DEPLOYER_PRIVATE_KEY"], cfg["DEPLOYER_ADDRESS"]

    eth = int(sh([str(CAST), "balance", deployer, "--rpc-url", RPC]).split()[0])
    print(f"deployer {deployer}  ETH {eth / 1e18:.6f}")

    print("deploying GavleGoatMarket (order book) ...")
    out = sh([str(FORGE), "create", "src/GavleGoatMarket.sol:GavleGoatMarket",
              "--rpc-url", RPC, "--private-key", key, "--broadcast",
              "--constructor-args", USDC, deployer,
              cfg["BETTING_CLOSES_AT"], cfg["RESOLUTION_DEADLINE"]],
             cwd=ROOT / "contracts")
    m = re.search(r"Deployed to: (0x[0-9a-fA-F]{40})", out)
    if not m:
        raise RuntimeError(f"no address:\n{out[-700:]}")
    book = m.group(1)
    print(f"order book: {book}")

    closes = sh([str(CAST), "call", book, "bettingClosesAt()(uint64)", "--rpc-url", RPC]).strip()
    res = sh([str(CAST), "call", book, "resolver()(address)", "--rpc-url", RPC]).strip()
    print(f"bettingClosesAt {closes.split()[0]}")
    print(f"resolver        {res.split()[0]}")

    (ROOT / ".env.deploy").write_text(
        (ROOT / ".env.deploy").read_text(encoding="utf-8") + f"\nBOOK_ADDRESS={book}\n",
        encoding="utf-8", newline="\n",
    )
    print("\nsaved BOOK_ADDRESS to .env.deploy")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
