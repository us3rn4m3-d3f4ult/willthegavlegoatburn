import { MARKET, GOAT_HISTORY } from "@/lib/market";
import { TradePanel } from "@/components/TradePanel";
import { Comments } from "@/components/Comments";
import { LiveMarket } from "@/components/LiveMarket";
import { OrderBookLive } from "@/components/OrderBookLive";
import { TradeProvider } from "@/components/TradeProvider";
import { MobileTradeBar } from "@/components/MobileTradeBar";
import { FAQ, SITE, faqJsonLd } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Will the Gävle goat burn in 2026?",
  description: SITE.description,
  alternates: { canonical: "/" },
};

const BURNED = GOAT_HISTORY.filter((g) => g.burned).length;
const TOTAL = GOAT_HISTORY.length;
const BURN_RATE = Math.round((BURNED / TOTAL) * 100);

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

          <section id="resolves" className="panel scroll-mt-24 p-5">
            <h2 className="eyebrow">Resolution</h2>
            <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-muted">
              <p>
                <span className="font-medium text-yes">Yes</span> if the goat catches fire at
                any point, however briefly, on purpose or not.
              </p>
              <p>
                <span className="font-medium text-no">No</span> if it never burns. Storm damage
                or a vehicle is No — nothing burned.
              </p>
              <p>
                If no goat is built at all, nothing burned, so it settles{" "}
                <span className="font-medium text-no">No</span>.
              </p>
            </div>
          </section>

          <OrderBookLive />

          <Comments />

          <section className="border-t border-line pt-7">
            <h2 className="eyebrow">Goat history</h2>
            <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
              <p className="num text-[56px] font-semibold leading-none tracking-[-0.04em] text-fg">
                {BURN_RATE}%
              </p>
              <p className="max-w-[30ch] pb-2 text-[13px] leading-relaxed text-muted">
                of the {TOTAL} recorded years ended in fire — {BURNED} goats burned.
              </p>
            </div>

            <details className="group mt-6 border-t border-line pt-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[12.5px] text-muted transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
                All {TOTAL} recorded years
                <span
                  aria-hidden="true"
                  className="text-[13px] leading-none text-dim transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <ul className="mt-2 divide-y divide-line">
                {GOAT_HISTORY.map((g) => (
                  <li key={g.year} className="flex items-baseline gap-6 py-2.5 text-[12.5px]">
                    <span className="num w-10 shrink-0 text-fg">{g.year}</span>
                    <span className="text-muted">{g.event}</span>
                    <span
                      className={`num ml-auto shrink-0 ${g.burned ? "text-yes" : "text-dim"}`}
                    >
                      {g.burned ? "burned" : "no fire"}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
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
