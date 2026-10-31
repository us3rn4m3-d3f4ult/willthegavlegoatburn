import Link from "next/link";
import { MARKET, GOAT_HISTORY } from "@/lib/market";
import { TradePanel } from "@/components/TradePanel";
import { Comments } from "@/components/Comments";
import { LiveMarket } from "@/components/LiveMarket";
import { OrderBookLive } from "@/components/OrderBookLive";
import { RecentTrades } from "@/components/RecentTrades";
import { TradeProvider } from "@/components/TradeProvider";
import { MobileTradeBar } from "@/components/MobileTradeBar";
import { FAQ, SITE, faqJsonLd } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Will the Gävle goat burn in 2026?",
  description: SITE.description,
  alternates: { canonical: "/" },
};

const RULES = [
  { label: "Yes", text: "It catches fire at any point, however briefly, on purpose or not.", tone: "yes" },
  { label: "No", text: "It never burns. Storm damage or a vehicle counts as No — nothing burned.", tone: "no" },
  { label: "No goat", text: "If nothing is built, nothing burned.", tone: "no" },
];

export default function HomePage() {
  return (
    <TradeProvider>
      <div className="grid gap-14 pb-32 pt-10 lg:grid-cols-[minmax(0,1fr)_356px] lg:pt-14">
        <div className="min-w-0 space-y-14">
          <section>
            <h1 className="max-w-[26ch] text-[32px] font-semibold leading-[1.08] tracking-[-0.03em] text-fg sm:text-[40px]">
              {MARKET.question}
            </h1>
            <LiveMarket />
          </section>

          <section id="resolves" className="scroll-mt-24 border-t border-line pt-7">
            <h2 className="eyebrow">Resolution</h2>
            <dl className="mt-4 divide-y divide-line">
              {RULES.map((r) => (
                <div key={r.label} className="flex gap-8 py-3 first:pt-0 last:pb-0">
                  <dt
                    className={`w-16 shrink-0 text-[12.5px] font-medium ${
                      r.tone === "yes" ? "text-yes" : "text-no"
                    }`}
                  >
                    {r.label}
                  </dt>
                  <dd className="text-[13px] leading-relaxed text-muted">{r.text}</dd>
                </div>
              ))}
            </dl>
          </section>

          <OrderBookLive />

          <RecentTrades />

          <Comments />

          <section className="border-t border-line pt-7">
            <h2 className="eyebrow">Goat history</h2>
            <ul className="mt-4 flex flex-wrap gap-x-12 gap-y-2 text-[13px]">
              {GOAT_HISTORY.filter((g) => [1966, 2021, 2025].includes(g.year)).map((g) => (
                <li key={g.year} className="num text-muted">
                  <span className="text-fg">{g.year}</span>{" "}
                  {g.burned ? (
                    <span className="text-yes">burned</span>
                  ) : (
                    <span className="text-dim">no fire</span>
                  )}
                </li>
              ))}
            </ul>
            <Link
              href="/goat-history"
              className="mt-4 inline-block text-[12.5px] text-muted transition-colors hover:text-fg"
            >
              All 60 years
            </Link>
          </section>

          <section className="border-t border-line pt-7">
            <h2 className="eyebrow">Questions</h2>
            <div className="mt-2 divide-y divide-line">
              {FAQ.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[13px] font-medium text-fg [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-[15px] leading-none text-dim transition-transform duration-200 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-2 max-w-[76ch] text-[13px] leading-relaxed text-muted">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </div>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
        />

        <aside className="hidden h-fit lg:sticky lg:top-20 lg:block">
          <TradePanel mid={MARKET.mid} />
        </aside>
      </div>
      <MobileTradeBar />
    </TradeProvider>
  );
}
