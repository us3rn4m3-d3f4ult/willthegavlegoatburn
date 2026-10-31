import Link from "next/link";
import { AbstractAvatar } from "./AbstractAvatar";

function FlameMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="flame" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff5c2b" />
          <stop offset="100%" stopColor="#ffb020" />
        </linearGradient>
      </defs>
      <path
        d="M12 2c.7 3.6 2.4 5.2 3.9 7 1.6 1.9 2.6 3.8 2.6 6.1A6.5 6.5 0 0 1 12 21.6a6.5 6.5 0 0 1-6.5-6.5c0-1.7.6-3.1 1.6-4.4.3 1.1.9 1.9 1.7 2.4-.2-3.6 1-6.8 3.2-9.1z"
        fill="url(#flame)"
      />
    </svg>
  );
}

export function Header({ seed = "guest" }: { seed?: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-black/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <FlameMark />
          <span className="text-[15px] font-semibold tracking-tight text-fg">
            willthegavlegoatburn
          </span>
          <span className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-dim sm:inline">
            2026
          </span>
        </Link>

        <Link
          href="/account"
          aria-label="Your account"
          className="rounded-[9px] ring-1 ring-line2 transition-all hover:brightness-110"
        >
          <AbstractAvatar seed={seed} size={32} />
        </Link>
      </div>
    </header>
  );
}
