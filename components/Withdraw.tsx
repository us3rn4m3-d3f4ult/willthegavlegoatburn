"use client";

import { useCallback, useEffect, useState } from "react";
import { BOOK_ABI, BOOK_ADDRESS, BOOK_CONFIGURED, chain, publicClient } from "@/lib/web3";
import { useWallet } from "@/components/WalletProvider";
import { useSession } from "@/components/useSession";
import { useOrderBook, refreshBook } from "@/components/useOrderBook";

const usd = (v: bigint) => `$${(Number(v) / 1e6).toFixed(2)}`;

/**
 * One button, one number: take everything back to the wallet.
 * Closes open orders (which frees the shares), merges Yes + No pairs back into
 * $1.00 each, then withdraws the cash.
 */
export function Withdraw() {
  const { account, connect, ensureChain, walletClient } = useWallet();
  const signedIn = useSession();
  const [raw, setRaw] = useState({ cash: 0n, yes: 0n, no: 0n });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  // Hooks run unconditionally, before any early return.
  const { book } = useOrderBook(account);

  const load = useCallback(async () => {
    if (signedIn !== true || !account || !BOOK_CONFIGURED) return;
    try {
      const [cash, yes, no] = (await publicClient.multicall({
        contracts: [
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "usdcBalance", args: [account] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "yesBalance", args: [account] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "noBalance", args: [account] },
        ],
        allowFailure: false,
      })) as bigint[];
      setRaw({ cash, yes, no });
    } catch {
      // Keep the last known figures; the action re-reads before sending.
    }
  }, [account, signedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  const mine = book?.mine ?? [];
  // Cash held by resting buy orders returns when those orders close.
  const inOrders = mine
    .filter((o) => o.isAsk === false)
    .reduce((sum, o) => sum + Math.round(o.price * o.shares * 1e6), 0);
  // A Yes and a No are worth $1.00 together, whether or not they are on sale.
  const pairs = raw.yes < raw.no ? raw.yes : raw.no;
  const total = raw.cash + BigInt(inOrders) + pairs;

  async function withdrawAll() {
    const w = walletClient();
    if (!w || !account) return;
    if (!(await ensureChain())) return;
    setBusy(true);
    setNote("");
    try {
      for (const o of mine) {
        setNote(`Closing order #${o.id}...`);
        const h = await w.writeContract({
          address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "cancelOrder", args: [BigInt(o.id)], chain, account,
        });
        await publicClient.waitForTransactionReceipt({ hash: h });
      }
      refreshBook();

      const [freeYes, freeNo] = (await publicClient.multicall({
        contracts: [
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "freeShares", args: [account, true] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "freeShares", args: [account, false] },
        ],
        allowFailure: false,
      })) as bigint[];

      const pairShares = freeYes < freeNo ? freeYes : freeNo;
      if (pairShares > 0n) {
        setNote("Turning your Yes + No pairs back into cash...");
        const h = await w.writeContract({
          address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "merge", args: [pairShares], chain, account,
        });
        await publicClient.waitForTransactionReceipt({ hash: h });
      }

      const credited = (await publicClient.readContract({
        address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "usdcBalance", args: [account],
      })) as bigint;

      if (credited > 0n) {
        setNote(`Confirm the withdrawal of ${usd(credited)}...`);
        const h = await w.writeContract({
          address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "withdraw", args: [credited], chain, account,
        });
        await publicClient.waitForTransactionReceipt({ hash: h });
        setNote(`${usd(credited)} is in your wallet.`);
      } else {
        setNote("Nothing left to withdraw.");
      }
      await load();
      refreshBook();
    } catch {
      setNote("Rejected. Nothing was sent, so nothing is lost.");
    } finally {
      setBusy(false);
    }
  }

  if (!BOOK_CONFIGURED) return null;
  // Without a session this panel would show whoever used the device last.
  if (signedIn !== true) return null;

  return (
    <section className="panel p-5">
      <h2 className="text-[13px] font-semibold text-fg">Withdraw</h2>

      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
        <span className="num text-fg">{account ? usd(total) : "n/a"}</span> can come back to your
        wallet.
      </p>

      <button
        type="button"
        onClick={() => {
          if (!account) {
            void connect();
            return;
          }
          void withdrawAll();
        }}
        disabled={busy || (Boolean(account) && total <= 0n)}
        className="mt-3 h-9 rounded-btn bg-fg px-4 text-[12.5px] font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy
          ? "Withdrawing..."
          : !account
            ? "Connect a wallet"
            : total > 0n
              ? `Withdraw ${usd(total)}`
              : "Nothing to withdraw"}
      </button>

      <p className="mt-2.5 text-[11px] leading-relaxed text-dim">
        Closes your open orders and sends everything to MetaMask. A few confirmations, nothing to
        fill in.
      </p>

      {note ? (
        <p aria-live="polite" className="mt-2 text-[11.5px] text-dim">
          {note}
        </p>
      ) : null}
    </section>
  );
}
