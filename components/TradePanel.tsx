"use client";

import { useMemo, useState } from "react";
import { MARKET } from "@/lib/market";
import { fmtUsd } from "@/lib/format";

const PRESETS = [10, 25, 50, 100];

export function TradePanel({ mid = MARKET.mid }: { mid?: number }) {
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState<string>("25");

  const price = side === "yes" ? Math.min(0.99, mid + 0.005) : Math.min(0.99, 1 - mid + 0.005);

  const { shares, payout } = useMemo(() => {
    const a = Number(amount) || 0;
    const s = price > 0 ? a / price : 0;
    return { shares: s, payout: s };
  }, [amount, price]);

  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSide("yes")}
          aria-pressed={side === "yes"}
          className={`h-10 rounded-btn text-[13px] font-semibold transition-colors ${
            side === "yes"
              ? "bg-yes text-black"
              : "bg-surface2 text-muted hover:text-fg"
          }`}
        >
          Buy Yes
        </button>
        <button
          type="button"
          onClick={() => setSide("no")}
          aria-pressed={side === "no"}
          className={`h-10 rounded-btn text-[13px] font-semibold transition-colors ${
            side === "no" ? "bg-no text-black" : "bg-surface2 text-muted hover:text-fg"
          }`}
        >
          Buy No
        </button>
      </div>

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
            className="h-7 flex-1 rounded-[7px] border border-line bg-surface2 text-[11.5px] text-muted transition-colors hover:border-line2 hover:text-fg"
          >
            ${p}
          </button>
        ))}
      </div>

      <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[12.5px]">
        <div className="flex justify-between">
          <dt className="text-muted">Avg price</dt>
          <dd className="num font-medium">{(price * 100).toFixed(1)}¢</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Shares</dt>
          <dd className="num font-medium">{shares.toFixed(2)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Payout if correct</dt>
          <dd className={`num font-semibold ${side === "yes" ? "text-yes" : "text-no"}`}>
            {fmtUsd(payout, 2)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Max loss</dt>
          <dd className="num font-medium">{fmtUsd(Number(amount) || 0, 2)}</dd>
        </div>
      </dl>

      <button
        type="button"
        disabled
        className="mt-4 h-11 w-full cursor-not-allowed rounded-btn bg-surface2 text-[13px] font-semibold text-muted"
      >
        Connect wallet to trade
      </button>
      <p className="mt-2.5 text-center text-[11px] leading-relaxed text-dim">
        Non-custodial. Funds never touch this website. 1 Yes + 1 No = 1 USDC, always.
      </p>
    </section>
  );
}
