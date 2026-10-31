"use client";

import { useEffect, useState } from "react";
import { fmtUsd } from "@/lib/format";

type Snap = {
  configured: boolean;
  price: number;
  liquidity: number;
  volume: number | null;
  traders: number | null;
  series: { t: number; p: number }[];
};

export function LiveMarket() {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch("/api/market", { cache: "no-store" })
        .then((r) => r.json() as Promise<Snap>)
        .then((d) => {
          if (!alive) return;
          setSnap(d);
          setFailed(false);
        })
        .catch(() => alive && setFailed(true));
    };
    load();
    const timer = setInterval(load, 60_000); // refresh every minute
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const pct = snap?.price ?? 0.5;
  const pts = snap?.series ?? [];

  const W = 640;
  const H = 150;
  const PAD = 8;
  const values = pts.length > 1 ? pts.map((x) => x.p) : [pct, pct];
  const min = Math.min(...values, pct);
  const max = Math.max(...values, pct);
  const range = max - min || 0.01;
  const coords = values.map((v, i) => {
    const x = PAD + (i / Math.max(1, values.length - 1)) * (W - PAD * 2);
    const y = PAD + (1 - (v - min) / range) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const label = (t: number) => {
    const d = new Date(t);
    return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  return (
    <>
      <div className="mt-6">
        <div className="flex items-end gap-3">
          <span className="num text-[64px] font-bold leading-none tracking-[-0.03em] text-fg">
            {(pct * 100).toFixed(0)}%
          </span>
          <span className="mb-2 text-[13px] font-medium text-muted">chance it burns</span>
        </div>

        <div className="mt-5 flex h-1 w-full overflow-hidden bg-surface2">
          <div className="h-full bg-yes" style={{ width: `${pct * 100}%` }} />
          <div className="h-full flex-1 bg-no/60" />
        </div>

        <div className="mt-2.5 flex justify-between text-[12px]">
          <span className="font-medium text-yes">Yes {(pct * 100).toFixed(1)}%</span>
          <span className="font-medium text-no">No {((1 - pct) * 100).toFixed(1)}%</span>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-5 border-t border-line pt-5 sm:grid-cols-4">
        {[
          { k: "Volume", v: snap?.volume === null || snap?.volume === undefined ? "—" : fmtUsd(snap.volume, 2) },
          { k: "Liquidity", v: snap ? fmtUsd(snap.liquidity, 2) : "—" },
          { k: "Traders", v: snap?.traders === null || snap?.traders === undefined ? "—" : String(snap.traders) },
          { k: "Source", v: "on-chain" },
        ].map((s) => (
          <div key={s.k}>
            <dt className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-dim">{s.k}</dt>
            <dd className="num mt-1 text-[14px] font-medium text-fg">{s.v}</dd>
          </div>
        ))}
      </dl>

      {failed ? (
        <p className="mt-3 text-[11.5px] text-dim">Live data unavailable right now.</p>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-card border border-line bg-surface">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[13px] font-semibold tracking-tight">Odds history</h2>
          <span className="text-[11px] text-dim">
            {pts.length > 1 ? `${pts.length} points, 1/min` : "collecting — one point per minute"}
          </span>
        </header>
        <div className="px-2 pt-3 pb-2">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-[150px] w-full" role="img" aria-label="Implied probability over time">
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={PAD} x2={W - PAD} y1={PAD + f * (H - PAD * 2)} y2={PAD + f * (H - PAD * 2)} stroke="#1c1c21" strokeWidth="1" />
            ))}
            <polyline points={coords.join(" ")} fill="none" stroke="#ff5c2b" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </div>
        {pts.length > 1 ? (
          <div className="flex justify-between border-t border-line px-4 py-1.5 text-[10px] text-dim">
            <span>{label(pts[0].t)}</span>
            <span>{label(pts[pts.length - 1].t)}</span>
          </div>
        ) : null}
      </section>
    </>
  );
}
