"use client";

import { useCallback, useEffect, useState } from "react";
import { WalletDeepLinks } from "@/components/WalletDeepLinks";
import { useWallet } from "@/components/WalletProvider";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * Links the trading wallet to the account, proven by a signature, so positions
 * follow the account to devices that have no wallet — read-only there, trading
 * still requires the key.
 */
export function WalletLink() {
  const { account, ensureChain, walletClient } = useWallet();
  const [me, setMe] = useState<{ id: string; wallet: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ user?: { id: string } | null; wallet?: string | null }>)
      .then((d) =>
        setMe(d.user ? { id: d.user.id, wallet: d.wallet ?? null } : null),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function link() {
    const w = walletClient();
    if (!w || !account || !me) return;
    if (!(await ensureChain())) return;
    setBusy(true);
    setNote("");
    try {
      const issued = new Date().toISOString();
      // Must match lib/walletLink.ts linkMessage byte for byte.
      const message = [
        "willthegavlegoatburn.com",
        "Link this wallet to my account.",
        "",
        `Account: ${me.id}`,
        `Address: ${account}`,
        `Issued: ${issued}`,
      ].join("\n");

      const signature = await w.signMessage({ account, message });
      const res = await fetch("/api/auth/link-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: account, signature, issued }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setMe({ id: me.id, wallet: account });
        setNote("Linked. Your positions now show on any device you sign in to.");
        return;
      }
      setNote(
        data.error === "already_linked"
          ? "That wallet is already linked to another account."
          : "Could not link that wallet.",
      );
    } catch {
      setNote("Signature cancelled.");
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    setNote("");
    try {
      await fetch("/api/auth/link-wallet", { method: "DELETE" });
      setMe((m) => (m ? { ...m, wallet: null } : m));
      setNote("Unlinked. Positions stay on the blockchain.");
    } finally {
      setBusy(false);
    }
  }

  const linked = me?.wallet ?? null;
  const isThisDevice = Boolean(linked && account && linked.toLowerCase() === account.toLowerCase());

  return (
    <section className="panel p-5">
      <h2 className="text-[13px] font-semibold text-fg">Linked wallet</h2>

      {linked ? (
        <>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
            <span className="num text-fg">{short(linked)}</span> is linked to this account.
            Positions show read-only on any device you sign in to.
          </p>
          {isThisDevice ? null : (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-dim">
              Not connected on this device — open the site in a wallet app to trade from here.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={unlink}
              disabled={busy}
              className="h-9 rounded-btn border border-line px-4 text-[12.5px] text-muted transition-colors hover:border-line2 hover:text-fg disabled:opacity-40"
            >
              Unlink
            </button>
            {isThisDevice ? null : <WalletDeepLinks note={false} />}
          </div>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
            Link the wallet you trade with. Only the public address is stored — no key, no
            custody — so your positions follow this account to every device.
          </p>
          <button
            type="button"
            onClick={link}
            disabled={busy || !account}
            className="mt-3 h-9 rounded-btn bg-fg px-4 text-[12.5px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Waiting for the signature…" : account ? "Link this wallet" : "Connect a wallet first"}
          </button>
          {account ? null : (
            <div className="mt-3">
              <WalletDeepLinks />
            </div>
          )}
        </>
      )}

      {note ? (
        <p aria-live="polite" className="mt-2 text-[11.5px] text-dim">
          {note}
        </p>
      ) : null}
    </section>
  );
}
