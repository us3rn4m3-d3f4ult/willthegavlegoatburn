"use client";

import { useCallback, useEffect, useState } from "react";
import { BOOK_ABI, BOOK_ADDRESS, BOOK_CONFIGURED, chain, publicClient } from "@/lib/web3";
import { useWallet } from "@/components/WalletProvider";
import type { Level } from "@/lib/book";

export function OpenOrders() {
  const { account, ensureChain, walletClient } = useWallet();
  const [orders, setOrders] = useState<Level[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    if (!account) return;
    fetch(`/api/orders?maker=${account.toLowerCase()}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ mine?: Level[] }>)
      .then((d) => setOrders(d.mine ?? []))
      .catch(() => {});
  }, [account]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  async function cancel(id: number) {
    if (!account || !(await ensureChain())) return;
    const wc = walletClient();
    if (!wc) return;
    setBusy(id);
    setNote("");
    try {
      const hash = await wc.writeContract({
        address: BOOK_ADDRESS,
        abi: BOOK_ABI,
        functionName: "cancelOrder",
        args: [BigInt(id)],
        chain,
        account,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setNote(`Order #${id} closed. The escrow is back on your in-market balance.`);
      load();
    } catch {
      setNote("Cancel was rejected.");
    } finally {
      setBusy(null);
    }
  }

  if (!BOOK_CONFIGURED) return null;

  return (
    <section className="rounded-card border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-semibold tracking-tight">Open positions</h2>
        <span className="text-[11px] text-dim">
          {!account ? "connect a wallet" : orders === null ? "loading" : `${orders.length} open`}
        </span>
      </header>

      {!account ? (
        <p className="px-4 py-4 text-[12.5px] leading-relaxed text-muted">
          Connect a wallet to see your resting orders and close them.
        </p>
      ) : orders && orders.length === 0 ? (
        <p className="px-4 py-4 text-[12.5px] leading-relaxed text-muted">
          No open orders. Anything you place at a limit price shows up here until it fills or
          you close it.
        </p>
      ) : (
        <ul className="divide-y divide-line/50">
          {(orders ?? []).map((o) => (
            <li key={o.id} className="flex items-center justify-between px-4 py-2.5 text-[12.5px]">
              <span className="text-muted">
                #{o.id} ·{" "}
                <span className={o.isYes ? "text-yes" : "text-no"}>{o.isYes ? "Yes" : "No"}</span>{" "}
                · <span className="num">{(o.price * 100).toFixed(1)}¢</span> ·{" "}
                <span className="num">{o.shares.toFixed(2)}</span> sh
              </span>
              <button
                type="button"
                onClick={() => cancel(o.id)}
                disabled={busy === o.id}
                className="rounded-[4px] border border-line px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-line2 hover:text-fg disabled:opacity-40"
              >
                {busy === o.id ? "…" : "Close"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {note ? (
        <p aria-live="polite" className="border-t border-line px-4 py-2 text-[11px] text-dim">
          {note}
        </p>
      ) : null}
    </section>
  );
}
