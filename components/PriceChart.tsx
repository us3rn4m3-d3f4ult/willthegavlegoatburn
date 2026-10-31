import { MARKET, PRICE_HISTORY } from "@/lib/market";

/**
 * Deterministic date window: the 30 days ending the day before betting closes.
 * The series itself is demo data until the indexer exists, so anchoring it to a
 * fixed date keeps the server-rendered HTML and the client identical — no
 * hydration mismatch, no labels that silently drift with the build date.
 */
function windowDates(count: number): Date[] {
  const end = new Date(MARKET.closesAt);
  end.setUTCDate(end.getUTCDate() - 1);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (count - 1 - i));
    return d;
  });
}

function ddmm(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function PriceChart({ data = PRICE_HISTORY }: { data?: number[] }) {
  const W = 640;
  const H = 170;
  const PAD_X = 8;
  const PAD_TOP = 10;
  const PAD_BOTTOM = 26;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const dates = windowDates(data.length);

  const pts = data.map((v, i) => {
    const x = PAD_X + (i / (data.length - 1)) * (W - PAD_X * 2);
    const y = PAD_TOP + (1 - (v - min) / range) * (H - PAD_TOP - PAD_BOTTOM);
    return { x, y, v, date: dates[i] };
  });

  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const labelIdx = [0, 7, 15, 22, 29].filter((i) => i < pts.length);

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-semibold tracking-tight">Odds history</h2>
        <span className="text-[11px] text-dim">30 days - implied probability</span>
      </header>

      <div className="px-2 pt-3 pb-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[170px] w-full"
          role="img"
          aria-label="Implied probability of YES over the last 30 days"
        >
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={PAD_X}
              x2={W - PAD_X}
              y1={PAD_TOP + f * (H - PAD_TOP - PAD_BOTTOM)}
              y2={PAD_TOP + f * (H - PAD_TOP - PAD_BOTTOM)}
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

          {/* Hover targets. The <title> gives a native tooltip with no JS. */}
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="9" fill="transparent">
                <title>{`${ddmm(p.date)} - ${(p.v * 100).toFixed(1)}% YES`}</title>
              </circle>
              <circle cx={p.x} cy={p.y} r="1.6" fill="#ff5c2b" opacity="0" />
            </g>
          ))}

          {labelIdx.map((i) => (
            <text
              key={`l-${i}`}
              x={pts[i].x}
              y={H - 8}
              textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}
              fill="#5a5a62"
              fontSize="10"
              fontFamily="inherit"
            >
              {ddmm(pts[i].date)}
            </text>
          ))}
        </svg>
      </div>
    </section>
  );
}
