"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BOOK_ABI,
  BOOK_ADDRESS,
  BOOK_CONFIGURED,
  ERC20_ABI,
  USDC_ADDRESS,
  publicClient,
} from "@/lib/web3";
import { useWallet } from "@/components/WalletProvider";

type Snap = {
  wallet: number;
  inMarket: number;
  yes: number;
  no: number;
  lockedYes: number;
  lockedNo: number;
  orders: number;
};

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function Portfolio() {
  const { account } = useWallet();
  const [snap, setSnap] = useState<Snap | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!account || !BOOK_CONFIGURED) return;
    try {
      const read = <T,>(fn: "usdcBalance" | "yesBalance" | "noBalance" | "lockedYes" | "lockedNo" | "openOrders") =>
        publicClient.readContract({
          address: BOOK_ADDRESS,
          abi: BOOK_ABI,
          functionName: fn,
          args: [account],
        }) as Promise<bigint>;

      const [wallet, inMarket, yes, no, lYes, lNo, orders] = await Promise.all([
        publicClient.readContract({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [account],
        }) as Promise<bigint>,
        read("usdcBalance"),
        read("yesBalance"),
        read("noBalance"),
        read("lockedYes"),
        read("lockedNo"),
        read("openOrders"),
      ]);

      setSnap({
        wallet: Number(wallet) / 1e6,
        inMarket: Number(inMarket) / 1e6,
        yes: Number(yes) / 1e6,
        no: Number(no) / 1e6,
        lockedYes: Number(lYes) / 1e6,
        lockedNo: Number(lNo) / 1e6,
        orders: Number(orders),
      });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [account]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    fetch("/api/market", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ price?: number }>)
      .then((d) => setPrice(typeof d.price === "number" ? d.price : null))
      .catch(() => {});
  }, []);

  if (!BOOK_CONFIGURED) return null;

  if (!account) {
    return (
      <section className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-[13px] font-semibold tracking-tight">Your money</h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          Connect a wallet to see your balance and positions.
        </p>
      </section>
    );
  }

  const p = price ?? 0.5;
  const portfolio =
    (snap?.yes ?? 0) * p + (snap?.no ?? 0) * (1 - p) + (snap?.inMarket ?? 0) + (snap?.wallet ?? 0);

  const tile = (label: string, value: string, note?: string) => (
    <div key={label} className="rounded-[6px] border border-line bg-black px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-dim">{label}</p>
      <p className="num mt-1 text-[15px] font-medium text-fg">{value}</p>
      {note ? <p className="num mt-0.5 text-[10.5px] text-dim">{note}</p> : null}
    </div>
  );

  return (
    <section className="rounded-card border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-semibold tracking-tight">Your money</h2>
        <span className="text-[11px] text-dim">
          {failed ? "reads failed" : snap ? "live from the contract" : "loading"}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
        {tile("In wallet", usd(snap?.wallet ?? 0), "USDC")}
        {tile("In market", usd(snap?.inMarket ?? 0), "free to withdraw")}
        {tile("Total", usd(portfolio), "wallet + market + shares")}
        {tile(
          `Yes shares`,
          (snap?.yes ?? 0).toFixed(2),
          snap && snap.lockedYes > 0 ? `${snap.lockedYes.toFixed(2)} on sale` : "none on sale",
        )}
        {tile(
          `No shares`,
          (snap?.no ?? 0).toFixed(2),
          snap && snap.lockedNo > 0 ? `${snap.lockedNo.toFixed(2)} on sale` : "none on sale",
        )}
        {tile("Open orders", String(snap?.orders ?? 0), "resting in the book")}
      </div>

      <footer className="border-t border-line px-4 py-2.5 text-[11px] leading-relaxed text-dim">
        Shares are valued at the current book price ({(p * 100).toFixed(1)}¢ yes,{" "}
        {((1 - p) * 100).toFixed(1)}¢ no). A matching yes and no pair always redeems for $1.00.
      </footer>
    </section>
  );
}
