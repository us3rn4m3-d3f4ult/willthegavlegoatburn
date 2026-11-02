"use client";

import { useCallback, useEffect, useState } from "react";
import { BOOK_ABI, BOOK_ADDRESS, BOOK_CONFIGURED, chain, publicClient } from "@/lib/web3";
import { useWallet } from "@/components/WalletProvider";
import { useSession } from "@/components/useSession";

const DECIMALS = 1_000_000n;
const usd = (v: bigint) => `$${(Number(v) / 1e6).toFixed(2)}`;

/**
 * One button: take everything back to the wallet.
 *
 * Cash leaves directly. Shares cannot be withdrawn — they are not USDC — so each
 * matched Yes + No pair is merged back into $1.00 first, then the whole cash
 * balance is sent. Two wallet confirmations, one decision.
 */
export function Withdraw() {
  const { account, connect, ensureChain, walletClient } = useWallet();
  const signedIn = useSession();
  const [raw, setRaw] = useState({ cash: 0n, freeYes: 0n, freeNo: 0n, yes: 0n, no: 0n });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (signedIn !== true || !account || !BOOK_CONFIGURED) return;
    try {
      // Bigints all the way through: a float round-trip can produce a withdraw
      // one wei larger than the balance, which the contract rejects.
      const [cash, freeYes, freeNo, yes, no] = (await publicClient.multicall({
        contracts: [
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "usdcBalance", args: [account] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "freeShares", args: [account, true] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "freeShares", args: [account, false] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "yesBalance", args: [account] },
          { address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "noBalance", args: [account] },
        ],
        allowFailure: false,
      })) as bigint[];
      setRaw({ cash, freeYes, freeNo, yes, no });
    } catch {
      // A failed read leaves the last known figures; the action re-reads anyway.
    }
  }, [account, signedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  // Only free shares can merge; the rest are escrowed in open sell orders.
  const pairs = raw.freeYes < raw.freeNo ? raw.freeYes : raw.freeNo;
  const onSale = raw.yes - raw.freeYes + (raw.no - raw.freeNo);
  const available = raw.cash + pairs;

  async function withdrawAll() {
    const w = walletClient();
    if (!w || !account) return;
    if (!(await ensureChain())) return;
    setBusy(true);
    setNote("");
    try {
      if (pairs > 0n) {
        setNote("Turning your Yes + No pairs back into cash…");
        const h1 = await w.writeContract({
          address: BOOK_ADDRESS,
          abi: BOOK_ABI,
          functionName: "merge",
          args: [pairs],
          chain,
          account,
        });
        await publicClient.waitForTransactionReceipt({ hash: h1 });
      }

      // Re-read rather than assume: the merge may have moved more or less than
      // the figure this render was built from.
      const cash = (await publicClient.readContract({
        address: BOOK_ADDRESS,
        abi: BOOK_ABI,
        functionName: "usdcBalance",
        args: [account],
      })) as bigint;

      if (cash > 0n) {
        setNote(`Confirm the withdrawal of ${usd(cash)}…`);
        const h2 = await w.writeContract({
          address: BOOK_ADDRESS,
          abi: BOOK_ABI,
          functionName: "withdraw",
          args: [cash],
          chain,
          account,
        });
        await publicClient.waitForTransactionReceipt({ hash: h2 });
        setNote(`${usd(cash)} is in your wallet.`);
      } else {
        setNote("Nothing left to withdraw.");
      }
      await load();
    } catch {
      setNote("Rejected — nothing was sent.");
    } finally {
      setBusy(false);
    }
  }

  if (!BOOK_CONFIGURED) return null;
  // A connected wallet is not an identity: without a session this panel would
  // show a stranger's — or a deleted account's — balance.
  if (signedIn !== true) return null;

  return (
    <section className="panel p-5">
      <h2 className="text-[13px] font-semibold text-fg">Withdraw</h2>

      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
        <span className="num text-fg">{account ? usd(available) : "—"}</span> can go back to your
        wallet.{" "}
        <span className="text-dim">
          {usd(raw.cash)} cash
          {pairs > 0n ? ` + ${usd(pairs)} in Yes/No pairs, which merge to $1.00 each` : ""}
        </span>
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
        disabled={busy || (Boolean(account) && available <= 0n)}
        className="mt-3 h-9 rounded-btn bg-fg px-4 text-[12.5px] font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy
          ? "Withdrawing…"
          : !account
            ? "Connect a wallet"
            : available > 0n
              ? `Withdraw ${usd(available)}`
              : "Nothing to withdraw"}
      </button>

      {onSale > 0n ? (
        <p className="mt-2.5 text-[11px] leading-relaxed text-dim">
          {(Number(onSale) / 1e6).toFixed(2)} shares are on sale in open orders — close those orders
          to include them.
        </p>
      ) : null}

      {note ? (
        <p aria-live="polite" className="mt-2 text-[11.5px] text-dim">
          {note}
        </p>
      ) : null}
    </section>
  );
}
