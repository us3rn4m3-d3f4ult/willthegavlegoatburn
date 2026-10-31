"use client";

import { useEffect, useState } from "react";

type Fill = {
  block: number;
  orderId: number;
  taker: string;
  shares: number;
  usdc: number;
  at: number;
};

const short = (a: string) => `${a.slice(0, 5)}…${a.slice(-4)}`;

function ago(t: number) {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86_400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86_400)}d`;
}

export function RecentTrades() {
  const [fills, setFills] = useState<Fill[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/trades", { cache: "no-store" })
        .then((r) => r.json() as Promise<{ trades: Fill[] }>)
        .then((d) => alive && setFills(d.trades))
        .catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const rows = fills ?? [];

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-semibold tracking-tight">Recent trades</h2>
        <span className="text-[11px] text-dim">
          {fills === null ? "loading" : rows.length === 0 ? "no fills yet" : `${rows.length} fills`}
        </span>
      </header>

      {rows.length === 0 ? (
        <p className="px-4 py-4 text-[12px] leading-relaxed text-muted">
          Nobody has taken an order yet. Trades appear here the moment one is filled.
        </p>
      ) : (
        <>
          <div className="flex justify-between px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-dim">
            <span>Shares</span>
            <span className="w-14 text-right">Price</span>
            <span className="w-20 text-right">Size</span>
            <span className="w-24 text-right">Taker</span>
            <span className="w-8 text-right">Age</span>
          </div>
          <ul className="divide-y divide-line/50">
            {rows.map((f) => {
              const price = f.shares > 0 ? f.usdc / f.shares : 0;
              return (
                <li
                  key={`${f.block}-${f.orderId}`}
                  className="flex items-center justify-between px-4 py-2 text-[12px]"
                >
                  <span className="num text-fg">{f.shares.toFixed(2)}</span>
                  <span className="num w-14 text-right text-muted">{(price * 100).toFixed(1)}¢</span>
                  <span className="num w-20 text-right text-muted">${f.usdc.toFixed(2)}</span>
                  <span className="num w-24 text-right text-[11px] text-dim">
                    {short(f.taker)}
                  </span>
                  <span className="num w-8 text-right text-[11px] text-dim">{ago(f.at)}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <footer className="border-t border-line px-4 py-2.5 text-[11px] text-dim">
        Read from OrderFilled events. The event carries the size and the USDC moved, not
        which side, so the price shown is what the taker paid per share.
      </footer>
    </section>
  );
}
