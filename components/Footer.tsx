import Link from "next/link";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Market",
    links: [
      { href: "/", label: "Trade" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/rules", label: "Resolution rules" },
      { href: "/goat-history", label: "Goat history" },
      { href: "/activity", label: "Activity" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy statement" },
      { href: "/terms", label: "Terms of use" },
      { href: "/risk", label: "Risk disclosure" },
      { href: "/cookies", label: "Cookies" },
    ],
  },
  {
    title: "About",
    links: [
      { href: "/legal", label: "Operator & contact" },
      { href: "/legal#complaints", label: "Complaints" },
      { href: "/status", label: "Status" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto max-w-[1120px] px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[15px] font-semibold tracking-tight">willthegavlegoatburn</p>
            <p className="mt-3 max-w-[26ch] text-[13px] leading-relaxed text-muted">
              A non-custodial prediction market on whether the Gävle goat survives 2026.
            </p>
            <p className="mt-4 text-[12px] text-dim">
              Built on Base · Settled in USDC · No protocol fees
            </p>
            <p className="mt-1 text-[12px] text-dim">
              You pay only your own network fee
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link
                      href={l.href}
                      className="text-[13px] text-muted transition-colors hover:text-fg"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 space-y-4 border-t border-line pt-8">
          <p className="max-w-[75ch] text-[12px] leading-relaxed text-dim">
            Unofficial fan project. Not affiliated with, endorsed by, or connected to Gävle
            kommun, Visit Gävle, the Southern Merchants of Gävle, or the Natural Science Club of
            Vasaskolan. &ldquo;Gävlebocken&rdquo; refers to the public artwork; no official imagery
            is used.
          </p>
          <p className="max-w-[75ch] text-[12px] leading-relaxed text-dim">
            Trading involves the risk of losing your entire stake. Nothing here is investment
            advice. Access is restricted in certain jurisdictions — see the{" "}
            <Link href="/terms" className="underline decoration-line2 underline-offset-2 hover:text-muted">
              Terms of use
            </Link>
            . 18+.
          </p>
          <p className="text-[12px] text-dim">
            © {new Date().getFullYear()} willthegavlegoatburn
          </p>
        </div>
      </div>
    </footer>
  );
}
