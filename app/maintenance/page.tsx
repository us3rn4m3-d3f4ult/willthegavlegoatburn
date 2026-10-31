import type { Metadata } from "next";
import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { NotifyForm } from "@/components/NotifyForm";

export const metadata: Metadata = {
  title: "Opening 1 November 2026",
  description:
    "Trading on the 2026 Gävle goat market opens on 1 November 2026. Leave your email and we'll tell you the moment it goes live.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/maintenance" },
};

const OPENS_AT = "2026-11-01T00:00:00+01:00";

export default function MaintenancePage() {
  return (
    <div className="mx-auto max-w-[640px] py-16 sm:py-24">
      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-yes">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yes" />
        Opening 1 November 2026
      </span>

      <h1 className="mt-5 text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-fg sm:text-[38px]">
        Trading opens on 1 November.
      </h1>

      <p className="mt-4 max-w-[52ch] text-[13.5px] leading-relaxed text-muted">
        The Gävle goat goes up on 29 November. Between now and then the market is
        closed while we finish the order book. Leave your email and we&rsquo;ll send
        one message the moment it opens — nothing else, ever.
      </p>

      <div className="mt-7 rounded-card border border-line bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-dim">
            Opens in
          </span>
          <Countdown to={OPENS_AT} />
        </div>
        <div className="mt-4">
          <NotifyForm />
        </div>
      </div>

      <ul className="mt-7 grid gap-2 text-[12px] text-muted sm:grid-cols-3">
        <li>Non-custodial</li>
        <li>No protocol fees</li>
        <li>Settled in USDC on Base</li>
      </ul>

      <p className="mt-8 text-[12px] leading-relaxed text-dim">
        Meanwhile, read{" "}
        <Link href="/rules" className="text-fg underline decoration-line2 underline-offset-2">
          how this resolves
        </Link>
        ,{" "}
        <Link href="/goat-history" className="text-fg underline decoration-line2 underline-offset-2">
          sixty years of the goat
        </Link>{" "}
        or the{" "}
        <Link href="/risk" className="text-fg underline decoration-line2 underline-offset-2">
          risk disclosure
        </Link>
        .
      </p>
    </div>
  );
}
