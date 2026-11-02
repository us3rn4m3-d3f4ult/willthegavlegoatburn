"use client";

import { useCallback, useEffect, useState } from "react";
import { units } from "@/lib/book";
import { BOOK_ABI, BOOK_ADDRESS, BOOK_CONFIGURED, chain, publicClient } from "@/lib/web3";
import { useWallet } from "@/components/WalletProvider";

const DECIMALS = 1_000_000; // USDC on Base

/** Pull free USDC out of the market contract and back into the wallet. */
export function Withdraw() {
  const { account, connect, ensureChain, walletClient } = useWallet();
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!account || !BOOK_CONFIGURED) return;
    try {
      const raw = (await publicClient.readContract({
        address: BOOK_ADDRESS,
        abi: BOOK_ABI,
        functionName: "usdcBalance",
        args: [account],
      })) as bigint;
      setAmount(Number(raw) / DECIMALS);
    } catch {
      // A failed read leaves the last known figure; withdrawing re-checks anyway.
    }
  }, [account]);

  useEffect(() => {
    void load();
  }, [load]);

  async function withdraw() {
    const w = walletClient();
    if (!w || !account || amount <= 0) return;
    if (!(await ensureChain())) return;
    setBusy(true);
    setNote("");
    try {
      const hash = await w.writeContract({
        address: BOOK_ADDRESS,
        abi: BOOK_ABI,
        functionName: "withdraw",
        args: [units(amount)],
        chain,
        account,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setAmount(0);
      setNote("Sent to your wallet.");
      void load();
    } catch {
      setNote("Withdraw rejected.");
    } finally {
      setBusy(false);
    }
  }

  if (!BOOK_CONFIGURED) return null;

  return (
    <section className="panel p-5">
      <h2 className="text-[13px] font-semibold text-fg">Withdraw</h2>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
        <span className="num text-fg">{account ? `${amount.toFixed(2)} USDC` : "—"}</span> is
        credited to you in the market contract, free to withdraw at any time. Money escrowed in
        open orders is not included.
      </p>

      <button
        type="button"
        onClick={() => {
          if (!account) {
            void connect();
            return;
          }
          void withdraw();
        }}
        disabled={busy || (Boolean(account) && amount <= 0)}
        className="mt-3 h-9 rounded-btn bg-fg px-4 text-[12.5px] font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Withdrawing…" : account ? `Withdraw ${amount.toFixed(2)} USDC` : "Connect a wallet"}
      </button>

      {note ? (
        <p aria-live="polite" className="mt-2 text-[11.5px] text-dim">
          {note}
        </p>
      ) : null}
    </section>
  );
}
