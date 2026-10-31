import Link from "next/link";
import { MARKET, GOAT_HISTORY, TRADES } from "@/lib/market";
import { Countdown } from "@/components/Countdown";
import { OddsBar } from "@/components/OddsBar";
import { OrderBook } from "@/components/OrderBook";
import { PriceChart } from "@/components/PriceChart";
import { TradePanel } from "@/components/TradePanel";
import { Comments } from "@/components/Comments";
import { fmtCompact, fmtUsd } from "@/lib/format";
import { FAQ, SITE, faqJsonLd } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Will the Gävle goat burn in 2026?",
  description: SITE.description,
  alternates: { canonical: "/" },
};

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-dim">{label}</dt>
      <dd className="num mt-1 text-[14px] font-medium text-fg">{value}</dd>
    </div>
  );
}

function RecentTrades() {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-semibold tracking-tight">Recent trades</h2>
        <span className="text-[11px] text-dim">live</span>
      </header>
      <ul className="divide-y divide-line">
        {TRADES.map((t, i) => (
          <li key={i} className="flex items-center justify-between px-4 py-2.5 text-[12.5px]">
            <span className={`font-medium ${t.side === "YES" ? "text-yes" : "text-no"}`}>
              {t.side === "YES" ? "Buy Yes" : "Buy No"}
            </span>
            <span className="num text-muted">
              {(t.price * 100).toFixed(1)}c - {fmtCompact(t.size)}
            </span>
            <span className="num w-9 text-right text-dim">{t.ago}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="grid gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
      <div className="min-w-0 space-y-6">
        <section className="rounded-card border border-line bg-surface p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-[4px] border border-yes/30 bg-yes/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-yes">
              Live
            </span>
            <span className="rounded-[4px] border border-line px-2 py-1 text-[10px] font-medium text-muted">
              Base - USDC
            </span>
            <span className="rounded-[4px] border border-ember/40 bg-ember/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ember">
              New
            </span>
          </div>

          <h1 className="mt-4 max-w-[22ch] text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-fg sm:text-[30px]">
            {MARKET.question}
          </h1>

          <div className="mt-6">
            <OddsBar value={MARKET.mid} />
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-5 border-t border-line pt-5 sm:grid-cols-4">
            <Stat label="Volume" value={fmtUsd(MARKET.volume)} />
            <Stat label="Liquidity" value={fmtUsd(MARKET.liquidity)} />
            <Stat label="Traders" value={MARKET.traders} />
            <Stat label="Closes in" value={<Countdown to={MARKET.closesAt} />} />
          </dl>
        </section>

        <PriceChart />

        <section className="rounded-card border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[13px] font-semibold tracking-tight">The goat has a history</h2>
            <Link
              href="/goat-history"
              className="text-[12px] text-muted underline decoration-line2 underline-offset-2 hover:text-fg"
            >
              All 60 years
            </Link>
          </div>
          <ul className="mt-3 grid gap-1.5 text-[12.5px] sm:grid-cols-3">
            {GOAT_HISTORY.filter((g) => [1966, 2021, 2025].includes(g.year)).map((g) => (
              <li key={g.year} className="text-muted">
                <span className="num font-medium text-fg">{g.year}</span>{" "}
                {g.burned ? (
                  <span className="text-yes">- burned</span>
                ) : (
                  <span className="text-no">- not fire</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section
          id="resolves"
          className="scroll-mt-24 rounded-card border border-line bg-surface p-5"
        >
          <h2 className="text-[13px] font-semibold tracking-tight">How this resolves</h2>
          <div className="mt-2.5 max-w-[70ch] space-y-2 text-[12.5px] leading-relaxed text-muted">
            <p>
              <span className="font-medium text-fg">Yes</span> if the goat catches fire at any
              point - a scorched leg or the whole thing to the ground, deliberate or accidental.
              It does not have to be destroyed.
            </p>
            <p>
              <span className="font-medium text-fg">No</span> if it never burns. Destroyed some
              other way - hit by a car in 2021, blown over by a storm in 2025 - is{" "}
              <span className="font-medium text-fg">No</span>, because nothing burned.
            </p>
            <p>
              If no goat goes up at all, nothing burned, so it settles{" "}
              <span className="font-medium text-fg">No</span>.
            </p>
          </div>
        </section>

        <div className="grid gap-6 sm:grid-cols-2">
          <OrderBook mid={MARKET.mid} />
          <RecentTrades />
        </div>

        <Comments />

        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-[13px] font-semibold tracking-tight">Questions people ask</h2>
          <dl className="mt-3 divide-y divide-line">
            {FAQ.map((item) => (
              <div key={item.q} className="py-3 first:pt-0 last:pb-0">
                <dt className="text-[12.5px] font-medium text-fg">{item.q}</dt>
                <dd className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />

      <aside className="h-fit space-y-4 lg:sticky lg:top-24">
        <TradePanel mid={MARKET.mid} />
      </aside>
    </div>
  );
}
