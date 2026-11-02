"use client";

import { useCallback, useEffect, useState } from "react";
import { BOOK_ABI, BOOK_ADDRESS, BOOK_CONFIGURED, chain, publicClient } from "@/lib/web3";
import { useWallet } from "@/components/WalletProvider";
import { useSession } from "@/components/useSession";
import type { Level } from "@/lib/book";

export function OpenOrders() {
  const { account, ensureChain, walletClient } = useWallet();
  const signedIn = useSession();
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
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">Open orders</h2>
        <span className="num text-[11.5px] text-dim">
          {!account ? "—" : orders === null ? "—" : orders.length}
        </span>
      </header>

      {!account ? (
        <p className="px-4 py-5 text-[12.5px] text-muted">
          {signedIn === true
            ? "Signed in — connect a wallet on this device to see its orders. On a phone, use the MetaMask or Coinbase Wallet in-app browser."
            : "Connect a wallet to see your orders."}
        </p>
      ) : orders && orders.length === 0 ? (
        <p className="px-4 py-5 text-[12.5px] text-muted">No open orders.</p>
      ) : (
        <ul className="divide-y divide-line">
          {(orders ?? []).map((o) => (
            <li key={o.id} className="flex items-center gap-3 px-4 py-2.5 text-[12.5px]">
              <span className="num text-dim">#{o.id}</span>
              <span className={o.isYes ? "text-yes" : "text-no"}>{o.isYes ? "Yes" : "No"}</span>
              <span className="num text-muted">{(o.price * 100).toFixed(1)}¢</span>
              <span className="num text-muted">{o.shares.toFixed(2)} sh</span>
              <button
                type="button"
                onClick={() => cancel(o.id)}
                disabled={busy === o.id}
                className="ml-auto h-7 border border-line px-2.5 text-[11.5px] text-muted transition-colors hover:border-line2 hover:text-fg disabled:opacity-40"
              >
                {busy === o.id ? "…" : "Close"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {note ? (
        <p aria-live="polite" className="border-t border-line px-4 py-2 text-[11.5px] text-dim">
          {note}
        </p>
      ) : null}
    </section>
  );
}
