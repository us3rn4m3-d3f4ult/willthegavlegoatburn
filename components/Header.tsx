import Link from "next/link";
import { AbstractAvatar } from "./AbstractAvatar";
import { ConnectWallet } from "./WalletProvider";

const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/goat-history", label: "History" },
];

export function Header({ seed = "guest" }: { seed?: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-black/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-8 px-4 sm:px-8">
        <Link
          href="/"
          aria-label="willthegavlegoatburn 2026 — home"
          className="flex items-baseline gap-1.5 transition-opacity hover:opacity-75"
        >
          <span className="text-[13.5px] font-semibold tracking-tight text-fg">
            willthegavlegoatburn
          </span>
          <span className="num text-[11px] font-medium text-dim">2026</span>
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-7 sm:flex">
          {NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[12.5px] text-muted transition-colors hover:text-fg"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <ConnectWallet />
          <Link
            href="/account"
            aria-label="Your account"
            className="opacity-75 transition-opacity hover:opacity-100"
          >
            <AbstractAvatar seed={seed} size={26} />
          </Link>
        </div>
      </div>
    </header>
  );
}
