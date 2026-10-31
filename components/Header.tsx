import Link from "next/link";
import { AbstractAvatar } from "./AbstractAvatar";

export function Header({ seed = "guest" }: { seed?: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-black/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6">
        <Link
          href="/"
          aria-label="willthegavlegoatburn 2026 — home"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <span className="text-[15px] font-semibold leading-none tracking-tight text-fg">
            willthegavlegoatburn
          </span>
          <span className="inline-flex h-[20px] shrink-0 items-center rounded-[4px] bg-white px-1.5 text-[10.5px] font-bold leading-none tracking-wide text-black">
            2026
          </span>
        </Link>

        <Link
          href="/account"
          aria-label="Your account"
          className="inline-flex items-center rounded-[9px] ring-1 ring-line2 transition-all hover:brightness-110"
        >
          <AbstractAvatar seed={seed} size={32} />
        </Link>
      </div>
    </header>
  );
}
