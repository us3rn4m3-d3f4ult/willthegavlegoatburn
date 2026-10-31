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

  // Symmetric around 50% so the midpoint of the chart IS 50%.
  const span = Math.max(
    0.04,
    ...values.map((v) => Math.abs(v - 0.5)),
    Math.abs(pct - 0.5),
  ) * 1.25;
  const min = 0.5 - span;
  const max = 0.5 + span;
  const range = max - min || 0.1;
  const yOf = (v: number) => PAD + (1 - (v - min) / range) * (H - PAD * 2);
  const coords = values.map((v, i) => {
    const x = PAD + (i / Math.max(1, values.length - 1)) * (W - PAD * 2);
    return `${x.toFixed(1)},${yOf(v).toFixed(1)}`;
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

      {/* Chart: no card, just the line. 50% sits exactly in the middle. */}
      <div className="mt-6">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[150px] w-full"
          role="img"
          aria-label="Implied probability over time, centred on 50 percent"
        >
          <line
            x1={PAD}
            x2={W - PAD}
            y1={yOf(0.5)}
            y2={yOf(0.5)}
            stroke="#26262d"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          <text x={PAD} y={yOf(0.5) - 4} fill="#5a5a62" fontSize="9">
            50%
          </text>
          <polyline
            points={coords.join(" ")}
            fill="none"
            stroke="#ff5c2b"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
        <div className="flex justify-between px-1 text-[10px] text-dim">
          <span>{pts.length > 1 ? label(pts[0].t) : ""}</span>
          <span>{pts.length > 1 ? `${pts.length} pts, 1/min` : "collecting — one point per minute"}</span>
          <span>{pts.length > 1 ? label(pts[pts.length - 1].t) : ""}</span>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-5 border-t border-line pt-5 sm:grid-cols-4">
        {[
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
    </>
  );
}
