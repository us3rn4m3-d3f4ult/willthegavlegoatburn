#!/usr/bin/env python3
"""
Local devnet: a real EVM with real transactions and zero faucets.

    python scripts/devnet.py            # starts, deploys, stays running
    python scripts/devnet.py --once     # same but exits after deploying

Deploys MockUSDC (test-only ERC20, 6 decimals), mints 10,000 USDC to three
accounts, then deploys GavleGoatMarket against it. Point MetaMask at the RPC and
you have a fully working market with funded wallets - no faucet, no mainnet
balance, no waiting.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from remote import load_env  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
FOUNDRY = ROOT / ".tools" / "foundry"
ANVIL, FORGE, CAST = FOUNDRY / "anvil.exe", FOUNDRY / "forge.exe", FOUNDRY / "cast.exe"

RPC = "http://127.0.0.1:8545"
CHAIN_ID = "84532"  # matches NEXT_PUBLIC_CHAIN_ID for Base Sepolia

# Anvil's deterministic accounts. Public knowledge, devnet only.
KEYS = [
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
]

for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass


def sh(args: list[str], cwd: Path | None = None) -> str:
    p = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    out = (p.stdout or "") + (p.stderr or "")
    if p.returncode != 0:
        raise RuntimeError(f"{' '.join(args[:3])} failed:\n{out[-1500:]}")
    return out


def rpc_up() -> bool:
    try:
        subprocess.run([str(CAST), "block-number", "--rpc-url", RPC], capture_output=True, check=True)
        return True
    except Exception:
        return False


def main() -> int:
    cfg = load_env(ROOT / ".env.deploy")
    once = "--once" in sys.argv

    print("starting anvil ...")
    anvil = subprocess.Popen(
        [str(ANVIL), "--port", "8545", "--chain-id", CHAIN_ID, "--accounts", "3",
         "--balance", "10000", "--block-time", "1"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )

    try:
        for _ in range(40):
            if rpc_up():
                break
            time.sleep(0.5)
        else:
            print("anvil did not start", file=sys.stderr)
            return 1

        addrs = [sh([str(CAST), "wallet", "address", "--private-key", k]).strip() for k in KEYS]
        print(f"anvil up | chain {CHAIN_ID} | rpc {RPC}")

        contracts = ROOT / "contracts"
        print("deploying MockUSDC ...")
        out = sh([str(FORGE), "create", "src/MockUSDC.sol:MockUSDC",
                  "--rpc-url", RPC, "--private-key", KEYS[0], "--broadcast"], cwd=contracts)
        usdc = re.search(r"Deployed to: (0x[0-9a-fA-F]{40})", out)
        if not usdc:
            raise RuntimeError(f"could not parse USDC address:\n{out[-800:]}")
        usdc_addr = usdc.group(1)

        for a in addrs:
            sh([str(CAST), "send", usdc_addr, "mint(address,uint256)", a, "10000000000",
                "--rpc-url", RPC, "--private-key", KEYS[0]])

        print("deploying GavleGoatMarket ...")
        out = sh([str(FORGE), "create", "src/GavleGoatMarket.sol:GavleGoatMarket",
                  "--rpc-url", RPC, "--private-key", KEYS[0], "--broadcast",
                  "--constructor-args", usdc_addr, addrs[0],
                  cfg["BETTING_CLOSES_AT"], cfg["RESOLUTION_DEADLINE"]], cwd=contracts)
        market = re.search(r"Deployed to: (0x[0-9a-fA-F]{40})", out)
        if not market:
            raise RuntimeError(f"could not parse market address:\n{out[-800:]}")
        market_addr = market.group(1)

        print("\n" + "=" * 66)
        print("  DEVNET READY  (fake chain, fake money, real contracts)")
        print("=" * 66)
        print(f"  RPC          {RPC}")
        print(f"  Chain ID     {CHAIN_ID}")
        print(f"  USDC         {usdc_addr}   (10,000 each)")
        print(f"  Market       {market_addr}")
        print("\n  MetaMask -> Add network manually:")
        print(f"    name: Devnet   rpc: {RPC}   chain: {CHAIN_ID}   symbol: ETH")
        print("\n  Import accounts (devnet keys, never use on a real network):")
        for i, (k, a) in enumerate(zip(KEYS, addrs)):
            print(f"    [{i}] {a}\n        {k}")
        print("\n  Next: put the market address in .env.local as")
        print(f"    NEXT_PUBLIC_MARKET_ADDRESS={market_addr}")
        print(f"    NEXT_PUBLIC_USDC_ADDRESS={usdc_addr}")
        print(f"    NEXT_PUBLIC_RPC_URL={RPC}")
        print("=" * 66 + "\n")

        if once:
            return 0

        print("anvil running - press Ctrl+C to stop\n")
        anvil.wait()
        return 0
    except KeyboardInterrupt:
        return 0
    except Exception as exc:
        print(f"\nFAILED: {exc}", file=sys.stderr)
        return 1
    finally:
        if once:
            anvil.terminate()
            try:
                anvil.wait(timeout=10)
            except subprocess.TimeoutExpired:
                anvil.kill()


if __name__ == "__main__":
    raise SystemExit(main())
