import type { Metadata } from "next";
import { TRADES } from "@/lib/market";
import { fmtCompact } from "@/lib/format";

export const metadata: Metadata = {
  title: "Activity",
  alternates: { canonical: "/activity" },
};


export default function ActivityPage() {
  return (
    <div className="mx-auto max-w-[860px] py-12">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Activity</h1>
      <p className="mt-2 text-[13px] text-muted">
        Every fill is a public on-chain event. Sample data shown until the market is deployed.
      </p>

      <div className="mt-6 overflow-hidden rounded-card border border-line bg-surface">
        <div className="grid grid-cols-[1fr_80px_90px_70px] gap-2 border-b border-line px-4 py-2.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-dim">
          <span>Side</span>
          <span className="text-right">Price</span>
          <span className="text-right">Size</span>
          <span className="text-right">Age</span>
        </div>
        <ul className="divide-y divide-line">
          {TRADES.map((t, i) => (
            <li
              key={i}
              className="grid grid-cols-[1fr_80px_90px_70px] gap-2 px-4 py-2.5 text-[12.5px]"
            >
              <span className={t.side === "YES" ? "text-yes" : "text-no"}>
                Buy {t.side === "YES" ? "Yes" : "No"}
              </span>
              <span className="num text-right text-muted">{(t.price * 100).toFixed(1)}¢</span>
              <span className="num text-right text-muted">{fmtCompact(t.size)}</span>
              <span className="num text-right text-dim">{t.ago}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
