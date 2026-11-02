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
    let timer: ReturnType<typeof setTimeout>;

    const load = async () => {
      try {
        const res = await fetch("/api/market", { cache: "no-store" });
        const d = (await res.json()) as Snap;
        if (!alive) return;
        setSnap(d);
        setFailed(false);
        // Poll quickly until volume and traders have caught up, then settle.
        const settled = d.volume !== null && d.traders !== null;
        timer = setTimeout(load, settled ? 60_000 : 4_000);
      } catch {
        if (!alive) return;
        setFailed(true);
        timer = setTimeout(load, 5_000);
      }
    };

    void load();

    // Coming back to the tab should show current numbers, not minute-old ones.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      void load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const pct = snap?.price ?? 0.5;
  const pts = snap?.series ?? [];

  const W = 640;
  const H = 140;
  const PX = 1; // half the stroke width, so the line reaches both edges
  const PY = 4; // vertical breathing room only
  const values = pts.length > 1 ? pts.map((x) => x.p) : [pct, pct];

  // Symmetric around 50% so the midpoint of the chart IS 50%.
  const span =
    Math.max(0.04, ...values.map((v) => Math.abs(v - 0.5)), Math.abs(pct - 0.5)) * 1.25;
  const min = 0.5 - span;
  const max = 0.5 + span;
  const range = max - min || 0.1;
  const yOf = (v: number) => PY + (1 - (v - min) / range) * (H - PY * 2);
  const coords = values.map((v, i) => {
    const x = PX + (i / Math.max(1, values.length - 1)) * (W - PX * 2);
    return `${x.toFixed(1)},${yOf(v).toFixed(1)}`;
  });

  const label = (t: number) => {
    const d = new Date(t);
    return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  const loading = snap === null;

  // null means "not known yet" — rendered as a skeleton, never as a dash.
  const stats: { k: string; v: string | null }[] = [
    { k: "Volume", v: snap && snap.volume !== null ? fmtUsd(snap.volume, 2) : null },
    { k: "Liquidity", v: snap ? fmtUsd(snap.liquidity, 2) : null },
    { k: "Traders", v: snap && snap.traders !== null ? String(snap.traders) : null },
    { k: "Closes", v: "1 Jan 2027" },
  ];

  return (
    <div>
      <div className="mt-10 flex flex-wrap items-end gap-x-12 gap-y-6">
        <div>
          <p className="eyebrow">Yes</p>
          {loading ? (
            <div className="shimmer mt-2 h-[56px] w-[9rem]" />
          ) : (
            <p className="num mt-2 text-[56px] font-semibold leading-none tracking-[-0.04em] text-fg">
              {(pct * 100).toFixed(0)}%
            </p>
          )}
        </div>
        <div className="pb-1">
          <p className="eyebrow">No</p>
          {loading ? (
            <div className="shimmer mt-2 h-5 w-16" />
          ) : (
            <p className="num mt-2 text-[20px] font-medium leading-none text-no">
              {((1 - pct) * 100).toFixed(1)}%
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="shimmer mt-8 h-[140px] w-full" />
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-8 block h-[140px] w-full"
          role="img"
          aria-label="Implied probability over time, centred on 50 percent"
        >
          <line
            x1={PX}
            x2={W - PX}
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
      )}

      {loading ? (
        <div className="mt-2 flex items-center justify-between">
          <div className="shimmer h-3 w-10" />
          <div className="shimmer h-3 w-16" />
          <div className="shimmer h-3 w-10" />
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between text-[10.5px] text-dim">
          <span className="num">{pts.length > 1 ? label(pts[0].t) : ""}</span>
          <span className="num">{(pct * 100).toFixed(1)}% now</span>
          <span className="num">{pts.length > 1 ? label(pts[pts.length - 1].t) : ""}</span>
        </div>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-y-6 border-y border-line py-6 sm:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.k} className={i > 0 ? "sm:border-l sm:border-line sm:pl-6" : ""}>
            <dt className="eyebrow">{s.k}</dt>
            {s.v === null ? (
              <div className="shimmer mt-2 h-[14px] w-16" />
            ) : (
              <dd className="num mt-1.5 text-[14px] font-medium text-fg">{s.v}</dd>
            )}
          </div>
        ))}
      </dl>

      {failed ? (
        <p className="mt-3 text-[12px] text-dim">Live data unavailable right now.</p>
      ) : null}
    </div>
  );
}
