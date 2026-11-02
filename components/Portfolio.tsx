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
import { useSession } from "@/components/useSession";
import { useOrderBook } from "@/components/useOrderBook";
import { WalletDeepLinks } from "@/components/WalletDeepLinks";

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
  const signedIn = useSession();
  const [snap, setSnap] = useState<Snap | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [linked, setLinked] = useState<`0x${string}` | null>(null);

  // The phone has no wallet, but the account knows which address to read. Only
  // ask while there is a session: a wallet that is still connected after a
  // sign-out must not become a read-only view of someone else's balance.
  useEffect(() => {
    if (signedIn !== true) {
      setLinked(null);
      return;
    }
    let alive = true;
    fetch(`/api/auth/me`, { cache: `no-store` })
      .then((r) => r.json() as Promise<{ wallet?: string | null }>)
      .then((d) => {
        if (alive) setLinked((d.wallet as `0x${string}` | null) ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [signedIn]);

  // No session, no address — the money panel is for the signed-in owner only.
  const addr = signedIn === true ? (account ?? linked) : null;

  const load = useCallback(async () => {
    if (!addr || !BOOK_CONFIGURED) return;
    try {
      // One multicall instead of seven round trips: this runs every 20s per tab.
      const [wallet, inMarket, yes, no, lYes, lNo, orders] = (await publicClient.multicall({
        contracts: [
          { address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "usdcBalance", args: [addr] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "yesBalance", args: [addr] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "noBalance", args: [addr] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "lockedYes", args: [addr] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "lockedNo", args: [addr] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "openOrders", args: [addr] },
        ],
        allowFailure: false,
      })) as bigint[];

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
  }, [addr]);

  useEffect(() => {
    if (!addr) {
      setSnap(null);
      setFailed(false);
      return;
    }
    void load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [addr, load]);

  useEffect(() => {
    fetch("/api/market", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ price?: number }>)
      .then((d) => setPrice(typeof d.price === "number" ? d.price : null))
      .catch(() => {});
  }, []);

  if (!BOOK_CONFIGURED) return null;

  if (!addr) {
    return (
      <section className="panel p-4">
        <h2 className="panel-title">Your money</h2>
        {signedIn === null ? (
          // Session check in flight: show neither balances nor a prompt, so a
          // signed-in owner never sees "sign in" flash on their own page.
          null
        ) : signedIn ? (
          <div className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-muted">
            <p>You are signed in, but no wallet is connected on this device.</p>
            <p className="text-dim">
              Your funds are on the blockchain and belong to the wallet, not to this account. On
              a desktop, install the browser extension instead.
            </p>
            <div className="pt-1">
              <WalletDeepLinks />
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
            Sign in, then connect a wallet, to see your balance and positions.
          </p>
        )}
      </section>
    );
  }

  const { book } = useOrderBook(addr);

  const p = price ?? 0.5;
  const mine = book?.mine ?? [];
  // A resting bid has already left the available balance: the contract holds
  // that USDC until the order fills or is cancelled. Without it the total
  // silently under-reports by whatever is committed to open orders.
  const lockedUsdc = mine
    .filter((o) => o.isAsk === false)
    .reduce((sum, o) => sum + o.price * o.shares, 0);
  const yesValue = (snap?.yes ?? 0) * p;
  const noValue = (snap?.no ?? 0) * (1 - p);
  const total = yesValue + noValue + (snap?.inMarket ?? 0) + (snap?.wallet ?? 0) + lockedUsdc;
  const openCount = mine.length || (snap?.orders ?? 0);

  const tile = (label: string, value: string, note?: string) => (
    <div key={label} className="border border-line px-3 py-2.5">
      <p className="eyebrow">{label}</p>
      <p className="num mt-1.5 text-[15px] font-medium text-fg">{value}</p>
      {note ? <p className="num mt-0.5 text-[10.5px] text-dim">{note}</p> : null}
    </div>
  );

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">Your money</h2>
      </header>

      {!account && linked ? (
        <p className="border-b border-line px-4 py-2 text-[11.5px] text-dim">
          Read-only · <span className="num">{linked.slice(0, 6)}…{linked.slice(-4)}</span> is the wallet
          linked to this account. Open the site in a wallet app to trade.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
        {tile("Ready to trade", usd(snap?.inMarket ?? 0), "USDC inside the market")}
        {tile("In your wallet", usd(snap?.wallet ?? 0), "not deposited yet")}
        {tile(
          "Locked in orders",
          usd(lockedUsdc),
          openCount === 1 ? "1 open order" : `${openCount} open orders`,
        )}
        {tile("Total", usd(total), "all of it, at this price")}
        {tile(
          "Yes shares",
          (snap?.yes ?? 0).toFixed(2),
          snap && snap.lockedYes > 0 ? `${snap.lockedYes.toFixed(2)} on sale` : `worth ${usd(yesValue)}`,
        )}
        {tile(
          "No shares",
          (snap?.no ?? 0).toFixed(2),
          snap && snap.lockedNo > 0 ? `${snap.lockedNo.toFixed(2)} on sale` : `worth ${usd(noValue)}`,
        )}
      </div>

      <p className="border-t border-line px-4 py-2.5 text-[11px] leading-relaxed text-dim">
        Your money is in one of three places, and Total counts all of them:
        <span className="text-muted"> ready to trade</span> (USDC the market holds for you),
        <span className="text-muted"> locked in orders</span> (a buy order holds its money until it
        fills or you cancel), and
        <span className="text-muted"> shares</span> (each is worth $1.00 if that side wins).
      </p>

      {failed ? (
        <p className="px-4 pb-2 text-[11px] text-dim">Balance read failed. Retrying on reload.</p>
      ) : null}
    </section>
  );
}
