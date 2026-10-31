import { ASKS, BIDS, type Level } from "@/lib/market";
import { fmtCents, fmtCompact } from "@/lib/format";

function Row({
  level,
  tone,
  max,
}: {
  level: Level;
  tone: "ask" | "bid";
  max: number;
}) {
  const pct = Math.max(4, (level.size / max) * 100);
  return (
    <div className="relative flex h-8 items-center justify-between px-3 text-[12.5px]">
      <div
        className={`absolute inset-y-[3px] right-0 rounded-[3px] ${
          tone === "ask" ? "bg-no/10" : "bg-yes/10"
        }`}
        style={{ width: `${pct}%` }}
        aria-hidden="true"
      />
      <span className={`num relative font-medium ${tone === "ask" ? "text-no" : "text-yes"}`}>
        {fmtCents(level.price)}
      </span>
      <span className="num relative text-muted">{fmtCompact(level.size)}</span>
    </div>
  );
}

export function OrderBook({
  asks = ASKS,
  bids = BIDS,
  mid,
}: {
  asks?: Level[];
  bids?: Level[];
  mid: number;
}) {
  const max = Math.max(...asks.map((a) => a.size), ...bids.map((b) => b.size));
  const bestAsk = asks[asks.length - 1]?.price ?? 0;
  const bestBid = bids[0]?.price ?? 0;
  const spread = bestAsk - bestBid;

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-semibold tracking-tight text-fg">Order book</h2>
        <span className="num text-[11px] text-dim">YES · USDC</span>
      </header>

      <div className="flex justify-between px-4 py-2 text-[10.5px] font-medium uppercase tracking-[0.1em] text-dim">
        <span>Price</span>
        <span>Size</span>
      </div>

      {/* asks: furthest first, best ask sits just above the spread */}
      <div className="flex flex-col-reverse">
        {asks.map((a) => (
          <Row key={`a-${a.price}`} level={a} tone="ask" max={max} />
        ))}
      </div>

      <div className="my-1.5 flex items-center justify-between border-y border-line bg-surface2/60 px-4 py-2">
        <span className="text-[11px] text-dim">Spread</span>
        <span className="num text-[12px] font-medium text-fg">
          {(spread * 100).toFixed(1)}¢
          <span className="ml-2 text-dim">mid {(mid * 100).toFixed(1)}¢</span>
        </span>
      </div>

      <div>
        {bids.map((b) => (
          <Row key={`b-${b.price}`} level={b} tone="bid" max={max} />
        ))}
      </div>

      <footer className="border-t border-line px-4 py-2.5 text-[11px] text-dim">
        Buying <span className="text-yes">YES</span> takes asks · selling hits bids
      </footer>
    </section>
  );
}
