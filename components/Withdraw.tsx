"use client";

import { useCallback, useEffect, useState } from "react";
import { units } from "@/lib/book";
import { BOOK_ABI, BOOK_ADDRESS, BOOK_CONFIGURED, chain, publicClient } from "@/lib/web3";
import { useWallet } from "@/components/WalletProvider";
import { useSession } from "@/components/useSession";

const DECIMALS = 1_000_000; // USDC on Base

/**
 * Take money out of the market.
 *
 * Cash comes straight out. Shares need one step first: a Yes and a No share are
 * always worth $1.00 together, so matched pairs merge back into USDC. Shares
 * sitting in open sell orders cannot merge until those orders are closed.
 */
export function Withdraw() {
  const { account, connect, ensureChain, walletClient } = useWallet();
  const signedIn = useSession();
  const [cash, setCash] = useState(0);
  const [free, setFree] = useState({ yes: 0, no: 0 });
  const [held, setHeld] = useState({ yes: 0, no: 0 });
  const [busy, setBusy] = useState<"" | "withdraw" | "merge">("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (signedIn !== true || !account || !BOOK_CONFIGURED) return;
    try {
      // One multicall for the five numbers this panel needs.
      const [usdc, freeYes, freeNo, yes, no] = (await publicClient.multicall({
        contracts: [
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "usdcBalance", args: [account] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "freeShares", args: [account, true] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "freeShares", args: [account, false] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "yesBalance", args: [account] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "noBalance", args: [account] },
        ],
        allowFailure: false,
      })) as bigint[];
      setCash(Number(usdc) / DECIMALS);
      setFree({ yes: Number(freeYes) / DECIMALS, no: Number(freeNo) / DECIMALS });
      setHeld({ yes: Number(yes) / DECIMALS, no: Number(no) / DECIMALS });
    } catch {
      // A failed read leaves the last known figures; the action re-checks anyway.
    }
  }, [account, signedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  // Only free shares can merge; the rest are escrowed in open sell orders.
  const pairs = Math.min(free.yes, free.no);
  const onSale = Math.max(0, held.yes - free.yes) + Math.max(0, held.no - free.no);

  async function run(kind: "withdraw" | "merge") {
    const w = walletClient();
    if (!w || !account) return;
    const amount = kind === "withdraw" ? cash : pairs;
    if (amount <= 0) return;
    if (!(await ensureChain())) return;
    setBusy(kind);
    setNote("");
    try {
      const hash = await w.writeContract({
        address: BOOK_ADDRESS,
        abi: BOOK_ABI,
        functionName: kind === "withdraw" ? "withdraw" : "merge",
        args: [units(amount)],
        chain,
        account,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setNote(
        kind === "withdraw"
          ? "Sent to your wallet."
          : `${amount.toFixed(2)} shares became ${amount.toFixed(2)} USDC — withdraw it below.`,
      );
      await load();
    } catch {
      setNote(kind === "withdraw" ? "Withdraw rejected." : "That merge was rejected.");
    } finally {
      setBusy("");
    }
  }

  if (!BOOK_CONFIGURED) return null;
  // A connected wallet is not an identity: without a session this panel would
  // show a stranger's — or a deleted account's — balance.
  if (signedIn !== true) return null;

  const button =
    "h-9 rounded-btn px-4 text-[12.5px] font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <section className="panel p-5">
      <h2 className="text-[13px] font-semibold text-fg">Withdraw</h2>

      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
        <span className="num text-fg">{account ? `${cash.toFixed(2)} USDC` : "—"}</span> in cash is
        free to withdraw now.
        {pairs > 0 ? (
          <>
            {" "}
            <span className="num text-fg">{pairs.toFixed(2)}</span> Yes + No pairs can be turned back
            into cash first.
          </>
        ) : null}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            if (!account) {
              void connect();
              return;
            }
            void run("withdraw");
          }}
          disabled={busy !== "" || (Boolean(account) && cash <= 0)}
          className={`${button} bg-fg text-black hover:opacity-90`}
        >
          {busy === "withdraw"
            ? "Withdrawing…"
            : account
              ? cash > 0
                ? `Withdraw ${cash.toFixed(2)} USDC`
                : "Nothing to withdraw"
              : "Connect a wallet"}
        </button>

        {pairs > 0 ? (
          <button
            type="button"
            onClick={() => void run("merge")}
            disabled={busy !== ""}
            className={`${button} border border-line text-muted hover:border-line2 hover:text-fg`}
          >
            {busy === "merge" ? "Converting…" : `Turn ${pairs.toFixed(2)} shares into cash`}
          </button>
        ) : null}
      </div>

      <p className="mt-2.5 text-[11px] leading-relaxed text-dim">
        A Yes and a No share are always worth $1.00 together, which is what the second button
        collects.
        {onSale > 0
          ? ` ${onSale.toFixed(2)} of your shares are on sale in open orders — close those orders to free them.`
          : ""}
      </p>

      {note ? (
        <p aria-live="polite" className="mt-2 text-[11.5px] text-dim">
          {note}
        </p>
      ) : null}
    </section>
  );
}
