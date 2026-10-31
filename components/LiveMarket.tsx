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
    const timer = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const pct = snap?.price ?? 0.5;
  const pts = snap?.series ?? [];

  const W = 640;
  const H = 140;
  const PAD = 6;
  const values = pts.length > 1 ? pts.map((x) => x.p) : [pct, pct];

  // Symmetric around 50% so the midpoint of the chart IS 50%.
  const span =
    Math.max(0.04, ...values.map((v) => Math.abs(v - 0.5)), Math.abs(pct - 0.5)) * 1.25;
  const min = 0.5 - span;
  const max = 0.5 + span;
  const range = max - min || 0.1;
  const yOf = (v: number) => PAD + (1 - (v - min) / range) * (H - PAD * 2);
  const coords = values.map((v, i) => {
    const x = PAD + (i / Math.max(1, values.length - 1)) * (W - PAD * 2);
    return `${x.toFixed(1)},${yOf(v).toFixed(1)}`;
  });

  const stats = [
    {
      k: "Volume",
      v: snap?.volume === null || snap?.volume === undefined ? "—" : fmtUsd(snap.volume, 2),
    },
    { k: "Liquidity", v: snap ? fmtUsd(snap.liquidity, 2) : "—" },
    {
      k: "Traders",
      v: snap?.traders === null || snap?.traders === undefined ? "—" : String(snap.traders),
    },
    { k: "Closes", v: "1 Jan 2027" },
  ];

  return (
    <div>
      <div className="mt-10 flex flex-wrap items-end gap-x-12 gap-y-6">
        <div>
          <p className="eyebrow">Yes</p>
          <p className="num mt-2 text-[56px] font-semibold leading-none tracking-[-0.04em] text-fg">
            {(pct * 100).toFixed(0)}%
          </p>
        </div>
        <div className="pb-1">
          <p className="eyebrow">No</p>
          <p className="num mt-2 text-[20px] font-medium leading-none text-no">
            {((1 - pct) * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="mt-7 flex h-[2px] w-full bg-line">
        <div className="h-full bg-yes" style={{ width: `${pct * 100}%` }} />
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-y-6 border-y border-line py-6 sm:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.k} className={i > 0 ? "sm:border-l sm:border-line sm:pl-6" : ""}>
            <dt className="eyebrow">{s.k}</dt>
            <dd className="num mt-1.5 text-[14px] font-medium text-fg">{s.v}</dd>
          </div>
        ))}
      </dl>

      <section className="panel mt-8 overflow-hidden">
        <header className="panel-head">
          <h2 className="panel-title">Odds history</h2>
        </header>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-[140px] w-full"
          role="img"
          aria-label="Implied probability over time, centred on 50 percent"
        >
          <line
            x1={PAD}
            x2={W - PAD}
            y1={yOf(0.5)}
            y2={yOf(0.5)}
            stroke="#2a2a2a"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
          <polyline
            points={coords.join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            className={pts.length > 1 ? "text-yes" : "text-dim"}
          />
        </svg>
      </section>

      {failed ? (
        <p className="mt-3 text-[12px] text-dim">Live data unavailable right now.</p>
      ) : null}
    </div>
  );
}
