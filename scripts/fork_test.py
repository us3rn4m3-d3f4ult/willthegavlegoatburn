#!/usr/bin/env python3
"""
End-to-end contract test against a local fork of Base mainnet.

    python scripts/fork_test.py

This is the "real funds" test that costs nothing: Anvil forks Base mainnet at the
current block, so the USDC contract at 0x8335...2913 is the *real* one with real
bytecode and real state. We fund our deployer with fake ETH on the fork, deploy
GavleGoatMarket against real USDC, and read it back.

Nothing touches a real chain. No real money exists anywhere in this script.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from remote import load_env  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
ANVIL = ROOT / ".tools" / "foundry" / "anvil.exe"
CAST = ROOT / ".tools" / "foundry" / "cast.exe"
FORGE = ROOT / ".tools" / "foundry" / "forge.exe"

RPC = "http://127.0.0.1:8545"
BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass


def rpc(method: str, params: list):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(RPC, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read()).get("result")


def wait_for_anvil(timeout: int = 60) -> bool:
    for _ in range(timeout):
        try:
            if rpc("eth_blockNumber", []) is not None:
                return True
        except Exception:
            pass
        time.sleep(1)
    return False


def main() -> int:
    cfg = load_env(ROOT / ".env.deploy")
    deployer = cfg["DEPLOYER_ADDRESS"]

    print(f"forking Base mainnet ... (deployer {deployer})")
    anvil = subprocess.Popen(
        [
            str(ANVIL),
            "--fork-url", "https://mainnet.base.org",
            "--chain-id", "8453",
            "--port", "8545",
            "--silent",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        if not wait_for_anvil():
            print("anvil did not start", file=sys.stderr)
            return 1

        block = rpc("eth_blockNumber", [])
        print(f"forked at block {int(block, 16)}")

        # Real USDC, from the fork. If this works the fork is genuinely live.
        symbol = subprocess.run(
            [str(CAST), "call", BASE_USDC, "symbol()(string)", "--rpc-url", RPC],
            capture_output=True, text=True,
        ).stdout.strip()
        decimals = subprocess.run(
            [str(CAST), "call", BASE_USDC, "decimals()(uint8)", "--rpc-url", RPC],
            capture_output=True, text=True,
        ).stdout.strip()
        print(f"real USDC on fork: symbol={symbol} decimals={decimals}")
        if "USDC" not in symbol or decimals != "6":
            print("USDC lookup failed - aborting", file=sys.stderr)
            return 1

        # Give the deployer gas on the fork (fake ETH, does not exist anywhere).
        rpc("anvil_setBalance", [deployer, hex(10**19)])
        balance = rpc("eth_getBalance", [deployer, "latest"])
        print(f"deployer fork balance: {int(balance, 16) / 1e18} ETH")

        env = os.environ.copy()
        env.update(
            DEPLOYER_PRIVATE_KEY=cfg["DEPLOYER_PRIVATE_KEY"],
            USDC_ADDRESS=BASE_USDC,
            RESOLVER_ADDRESS=deployer,
            BETTING_CLOSES_AT=cfg["BETTING_CLOSES_AT"],
            RESOLUTION_DEADLINE=cfg["RESOLUTION_DEADLINE"],
        )

        print("\nrunning Deploy.s.sol against the fork ...")
        proc = subprocess.run(
            [str(FORGE), "script", "script/Deploy.s.sol", "--rpc-url", RPC, "--broadcast", "-vv"],
            cwd=ROOT / "contracts", env=env, capture_output=True, text=True,
        )
        out = (proc.stdout or "") + (proc.stderr or "")
        print("\n".join(out.splitlines()[-14:]))

        if proc.returncode != 0:
            print("\nDEPLOY FAILED", file=sys.stderr)
            return 1

        print("\nOK: contract deployed against real USDC bytecode on a Base fork.")
        print("Nothing was written to a real chain.")
        return 0
    finally:
        anvil.terminate()
        try:
            anvil.wait(timeout=10)
        except subprocess.TimeoutExpired:
            anvil.kill()


if __name__ == "__main__":
    raise SystemExit(main())
