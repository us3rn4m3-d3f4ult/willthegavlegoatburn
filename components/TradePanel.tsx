"use client";

import { useEffect, useState } from "react";
import { parseUnits } from "viem";
import { MARKET } from "@/lib/market";
import { fmtUsd } from "@/lib/format";
import {
  AMM_ABI,
  CONFIGURED,
  ERC20_ABI,
  MARKET_ADDRESS,
  USDC_ADDRESS,
  chain,
  publicClient,
} from "@/lib/web3";
import { useWallet } from "@/components/WalletProvider";

const PRESETS = [10, 25, 50, 100];

export function TradePanel({ mid = MARKET.mid }: { mid?: number }) {
  const { account, connect, ensureChain, walletClient } = useWallet();
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState("25");
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [quote, setQuote] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  // Live odds from the contract, refreshed every 15s.
  useEffect(() => {
    if (!CONFIGURED) return;
    let alive = true;
    const load = () => {
      publicClient
        .readContract({ address: MARKET_ADDRESS, abi: AMM_ABI, functionName: "yesPrice" })
        .then((p) => alive && setLivePrice(Number(p as bigint) / 1e18))
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // Exact shares for the amount entered, straight from the contract.
  useEffect(() => {
    if (!CONFIGURED) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setQuote(null);
      return;
    }
    let alive = true;
    publicClient
      .readContract({
        address: MARKET_ADDRESS,
        abi: AMM_ABI,
        functionName: "quoteBuy",
        args: [side === "yes", parseUnits(String(value), 6)],
      })
      .then((q) => alive && setQuote(Number(q as bigint) / 1e6))
      .catch(() => alive && setQuote(null));
    return () => {
      alive = false;
    };
  }, [amount, side]);

  const price = livePrice ?? (side === "yes" ? mid + 0.005 : 1 - mid + 0.005);
  const shares = quote ?? (Number(amount) || 0) / price;

  async function onTrade() {
    if (!CONFIGURED) {
      setStatus("No market deployed yet.");
      return;
    }
    if (!account) {
      await connect();
      return;
    }
    if (!(await ensureChain())) {
      setStatus("Switch network in your wallet first.");
      return;
    }
    const wc = walletClient();
    if (!wc) return;

    setBusy(true);
    try {
      const value = parseUnits(String(Number(amount)), 6);

      setStatus("Checking allowance…");
      const allowance = (await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [account, MARKET_ADDRESS],
      })) as bigint;

      // Exact-amount approval, never unlimited.
      if (allowance < value) {
        setStatus("Approve USDC in your wallet…");
        const approveHash = await wc.writeContract({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [MARKET_ADDRESS, value],
          chain,
          account,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setStatus("Confirm the trade in your wallet…");
      const hash = await wc.writeContract({
        address: MARKET_ADDRESS,
        abi: AMM_ABI,
        functionName: "buy",
        args: [side === "yes", value, 0n],
        chain,
        account,
      });
      setStatus("Sent. Waiting for confirmation…");
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus(`Done: ${hash.slice(0, 10)}…${hash.slice(-6)}`);

      const p = (await publicClient.readContract({
        address: MARKET_ADDRESS,
        abi: AMM_ABI,
        functionName: "yesPrice",
      })) as bigint;
      setLivePrice(Number(p) / 1e18);
    } catch (err) {
      const msg = (err as { shortMessage?: string }).shortMessage ?? "";
      setStatus(msg ? `Failed: ${msg}` : "Transaction rejected or failed.");
    } finally {
      setBusy(false);
    }
  }

  const label = !CONFIGURED
    ? "Market not deployed"
    : !account
      ? "Connect wallet to trade"
      : `Buy ${side === "yes" ? "Yes" : "No"} for ${fmtUsd(Number(amount) || 0, 2)}`;


  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <fieldset>
        <legend className="sr-only">Which side</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["yes", "no"] as const).map((s) => {
            const shown = s === "yes" ? price : 1 - price;
            return (
              <label key={s} className="cursor-pointer">
                <input
                  type="radio"
                  name="side"
                  value={s}
                  className="peer sr-only"
                  defaultChecked={s === "yes"}
                  onChange={() => {
                    setSide(s);
                    setStatus("");
                  }}
                />
                <span className="flex h-10 flex-col items-center justify-center rounded-btn bg-surface2 text-[12.5px] font-semibold text-muted transition-colors peer-checked:bg-yes peer-checked:text-black peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-yes/60">
                  <span>Buy {s === "yes" ? "Yes" : "No"}</span>
                  <span className="num text-[10.5px] font-medium opacity-80">
                    {(shown * 100).toFixed(1)}c
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label htmlFor="amount" className="mt-4 block text-[11px] font-medium text-dim">
        Amount
      </label>
      <div className="mt-1.5 flex items-center gap-2 rounded-btn border border-line bg-black px-3 focus-within:border-line2">
        <input
          id="amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          className="num h-11 w-full bg-transparent text-[15px] text-fg outline-none placeholder:text-dim"
          placeholder="0.00"
        />
        <span className="text-[13px] font-medium text-dim">USDC</span>
      </div>

      <div className="mt-2 flex gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(String(p))}
            className="h-7 flex-1 rounded-[5px] border border-line bg-surface2 text-[11.5px] text-muted transition-colors hover:border-line2 hover:text-fg"
          >
            ${p}
          </button>
        ))}
      </div>

      <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[12.5px]">
        <div className="flex justify-between">
          <dt className="text-muted">Price</dt>
          <dd className="num font-medium">{(price * 100).toFixed(1)}c</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Shares</dt>
          <dd className="num font-medium">{shares.toFixed(2)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Payout if correct</dt>
          <dd className={`num font-semibold ${side === "yes" ? "text-yes" : "text-no"}`}>
            {fmtUsd(shares, 2)}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onTrade}
        disabled={busy || !CONFIGURED}
        className="mt-4 h-11 w-full rounded-btn bg-fg text-[13px] font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Working…" : label}
      </button>

      {status ? (
        <p aria-live="polite" className="mt-2 text-center text-[11.5px] leading-relaxed text-muted">
          {status}
        </p>
      ) : (
        <p className="mt-2.5 text-center text-[11px] leading-relaxed text-dim">
          No protocol fee. You pay only the network fee for your own transaction.
        </p>
      )}
    </section>
  );
}
