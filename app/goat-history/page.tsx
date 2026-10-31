import type { Metadata } from "next";
import { GOAT_HISTORY } from "@/lib/market";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Goat history",
  description:
    "Sixty years of the Gävle goat: which years it burned, which years it survived, and the years it was destroyed by something other than fire.",
  alternates: { canonical: "/goat-history" },
};

export default function GoatHistoryPage() {
  return (
    <div className="mx-auto max-w-[70ch] py-12">
      <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Sixty years of the goat</h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
        Not every destruction is a burning. The distinction matters here, because the market pays out
        on <span className="text-yes">fire</span> and nothing else.
      </p>

      <ol className="mt-8 space-y-0">
        {GOAT_HISTORY.map((g) => (
          <li
            key={g.year}
            className="flex gap-5 border-b border-line py-3.5 last:border-0"
          >
            <span className="num w-12 shrink-0 text-[13px] font-medium text-dim">{g.year}</span>
            <span className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-muted">
              {g.event}
            </span>
            <span
              className={`shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                g.burned ? "text-yes" : "text-no"
              }`}
            >
              {g.burned ? "burned" : "not fire"}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-8 text-[12px] leading-relaxed text-dim">
        Summary only, not a complete record. Sources: public reporting by SVT, Aftonbladet and
        others. See the <Link href="/rules" className="underline decoration-line2 underline-offset-2">resolution rules</Link>{" "}
        for the full definition used by this market.
      </p>
    </div>
  );
}
