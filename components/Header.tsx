import Link from "next/link";
import { ConnectWallet } from "./WalletProvider";
import { HeaderLinks, HeaderMenu } from "./HeaderNav";

export function Header() {
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

        <HeaderLinks />

        <div className="ml-auto flex items-center gap-3">
          {/* Wallet lives in the menu below lg, where there is room for it. */}
          <div className="hidden lg:flex">
            <ConnectWallet />
          </div>
          <HeaderMenu />
        </div>
      </div>
    </header>
  );
}
