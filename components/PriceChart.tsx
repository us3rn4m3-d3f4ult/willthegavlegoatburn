import { PRICE_HISTORY } from "@/lib/market";

export function PriceChart({ data = PRICE_HISTORY }: { data?: number[] }) {
  const W = 640;
  const H = 170;
  const PAD = 8;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map(
    (v, i) =>
      [
        PAD + (i / (data.length - 1)) * (W - PAD * 2),
        PAD + (1 - (v - min) / range) * (H - PAD * 2),
      ] as const,
  );

  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-semibold tracking-tight">Odds history</h2>
        <span className="text-[11px] text-dim">30 days · implied probability</span>
      </header>

      <div className="px-2 pt-3 pb-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[170px] w-full" role="img" aria-label="Implied probability of YES over the last 30 days">
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={PAD}
              x2={W - PAD}
              y1={PAD + f * (H - PAD * 2)}
              y2={PAD + f * (H - PAD * 2)}
              stroke="#1c1c21"
              strokeWidth="1"
            />
          ))}
          <polyline
            points={line}
            fill="none"
            stroke="#ff5c2b"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </section>
  );
}
