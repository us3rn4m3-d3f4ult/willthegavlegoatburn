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
    <div className="mx-auto max-w-[74ch] py-14">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-fg">
        Sixty years of the goat
      </h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
        Not every destruction is a burning. The distinction matters here, because the market pays
        out on <span className="text-yes">fire</span> and nothing else.
      </p>

      <ol className="mt-10 border-t border-line">
        {GOAT_HISTORY.map((g) => (
          <li
            key={g.year}
            className="flex items-baseline gap-5 border-b border-line py-3 text-[12.5px]"
          >
            <span className="num w-10 shrink-0 text-fg">{g.year}</span>
            <span className="min-w-0 flex-1 leading-relaxed text-muted">{g.event}</span>
            <span
              className={`num shrink-0 ${g.burned ? "text-yes" : "text-dim"}`}
            >
              {g.burned ? "burned" : "no fire"}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-8 text-[12px] leading-relaxed text-dim">
        All sixty years, counting only the main goat on Slottstorget. Source: the year-by-year
        record in the English Wikipedia article on the Gävle goat. See the{" "}
        <Link href="/#resolves" className="text-muted underline underline-offset-2">
          resolution rules
        </Link>{" "}
        for the definition this market uses.
      </p>
    </div>
  );
}
