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

type Snap = { wallet: number; cash: number; yes: number; no: number };

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * One number: everything the wallet owns, wherever it happens to be sitting.
 * The breakdown lives in the withdraw panel, which is the only place it matters.
 */
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

  const addr = signedIn === true ? (account ?? linked) : null;

  // Hooks run unconditionally, before any early return: `addr` arrives after
  // mount when the wallet reconnects, and a conditional hook crashes the page.
  const { book } = useOrderBook(addr);

  const load = useCallback(async () => {
    if (!addr || !BOOK_CONFIGURED) return;
    try {
      const [wallet, cash, yes, no] = (await publicClient.multicall({
        contracts: [
          { address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "usdcBalance", args: [addr] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "yesBalance", args: [addr] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "noBalance", args: [addr] },
        ],
        allowFailure: false,
      })) as bigint[];
      setSnap({
        wallet: Number(wallet) / 1e6,
        cash: Number(cash) / 1e6,
        yes: Number(yes) / 1e6,
        no: Number(no) / 1e6,
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
        {signedIn === null ? null : signedIn ? (
          <div className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-muted">
            <p>You are signed in, but no wallet is connected on this device.</p>
            <div className="pt-1">
              <WalletDeepLinks />
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
            Sign in, then connect a wallet, to see your balance.
          </p>
        )}
      </section>
    );
  }

  const p = price ?? 0.5;
  // Cash the contract holds, cash set aside by a resting buy order, and the
  // shares valued at the current price.
  const locked = (book?.mine ?? [])
    .filter((o) => o.isAsk === false)
    .reduce((sum, o) => sum + o.price * o.shares, 0);
  const total = (snap?.wallet ?? 0) + (snap?.cash ?? 0) + locked + (snap?.yes ?? 0) * p + (snap?.no ?? 0) * (1 - p);

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">Your money</h2>
      </header>

      <div className="px-4 py-6 text-right">
        <p className="num text-[32px] font-semibold leading-none tracking-[-0.02em] text-fg">
          {usd(total)}
        </p>
        <p className="mt-2 text-[11px] text-dim">cash, shares and open orders together</p>
      </div>

      {failed ? (
        <p className="border-t border-line px-4 py-2 text-[11px] text-dim">
          Balance read failed. Retrying on reload.
        </p>
      ) : null}
    </section>
  );
}
