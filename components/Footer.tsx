import Link from "next/link";
import { SITE } from "@/lib/seo";

const LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/#resolves", label: "Resolution" },
  { href: "/goat-history", label: "Goat history" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/risk", label: "Risk" },
  { href: "/cookies", label: "Cookies" },
];

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line pb-24 lg:pb-0">
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[13px] font-medium text-fg">willthegavlegoatburn</p>
            <p className="mt-2 max-w-[36ch] text-[12.5px] leading-relaxed text-muted">
              Non-custodial prediction market on the Gävle goat. Base, USDC, no protocol fees.
            </p>
            <a
              href={SITE.repo}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-[12px] text-dim transition-colors hover:text-muted"
            >
              Source
            </a>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-12 gap-y-2 text-[12.5px] sm:grid-cols-3"
          >
            {LINKS.map((l) => (
              <Link
                key={l.href + l.label}
                href={l.href}
                className="text-muted transition-colors hover:text-fg"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-10 space-y-2 border-t border-line pt-6 text-[11.5px] leading-relaxed text-dim">
          <p className="max-w-[92ch]">
            Unofficial fan project. Not affiliated with Gävle kommun, Visit Gävle, the Southern
            Merchants of Gävle, or the Natural Science Club of Vasaskolan.
          </p>
          <p className="max-w-[92ch]">
            Trading can lose your entire stake. Not investment advice. 18+. Restricted in some
            jurisdictions — see{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-muted">
              Terms
            </Link>
            .
          </p>
          <p>
            © {new Date().getFullYear()} willthegavlegoatburn ·{" "}
            <a href="mailto:contact@willthegavlegoatburn.com" className="hover:text-muted">
              contact@willthegavlegoatburn.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
