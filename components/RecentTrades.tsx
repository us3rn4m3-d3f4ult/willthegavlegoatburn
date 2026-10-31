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
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">Recent trades</h2>
      </header>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-[12.5px] text-muted">
          {fills === null ? "—" : "No fills yet."}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-4 border-b border-line px-4 py-2">
            <span className="eyebrow w-20">Price</span>
            <span className="eyebrow w-20 text-right">Shares</span>
            <span className="eyebrow w-20 text-right">Value</span>
            <span className="eyebrow ml-auto text-right">Age</span>
          </div>
          <ul className="divide-y divide-line">
            {rows.map((f) => {
              const price = f.shares > 0 ? f.usdc / f.shares : 0;
              return (
                <li
                  key={`${f.block}-${f.orderId}`}
                  className="flex items-center gap-4 px-4 py-2.5 text-[12.5px]"
                >
                  <span className="num w-20 text-fg">{(price * 100).toFixed(1)}¢</span>
                  <span className="num w-20 text-right text-muted">{f.shares.toFixed(2)}</span>
                  <span className="num w-20 text-right text-muted">${f.usdc.toFixed(2)}</span>
                  <span className="num ml-auto text-right text-dim">{ago(f.at)}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
