"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AbstractAvatar } from "@/components/AbstractAvatar";
import { ConnectWallet } from "@/components/WalletProvider";
import { useSessionUser } from "@/components/useSession";

const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/goat-history", label: "History" },
];

/** Desktop section links. Kept here so `aria-current` follows the route. */
export function HeaderLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections" className="hidden items-center gap-7 lg:flex">
      {NAV.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={pathname === l.href ? "page" : undefined}
          className={`text-[12.5px] transition-colors hover:text-fg ${
            pathname === l.href ? "text-fg" : "text-muted"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Avatar + menu button. The header used to show the same "guest" avatar to
 * everyone and had no navigation at all below `sm` — the links only existed in
 * the footer, which is no use on a phone.
 */
export function HeaderMenu() {
  const pathname = usePathname();
  const { signedIn, email } = useSessionUser();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex items-center gap-2">
      {signedIn === true ? (
        <Link
          href="/account"
          aria-label="Your account"
          className="opacity-75 transition-opacity hover:opacity-100"
        >
          <AbstractAvatar seed={email ?? "you"} size={26} />
        </Link>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="header-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex h-10 w-10 items-center justify-center rounded-btn border border-line text-muted transition-colors hover:border-line2 hover:text-fg lg:hidden"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {open ? (
        <>
          {/* Dim everything under the header so the menu is unmistakably "on". */}
          <div
            className="fixed inset-0 top-14 z-40 bg-black/75 lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <nav
            id="header-menu"
            aria-label="Menu"
            className="absolute inset-x-0 top-14 z-50 border-b border-line bg-black px-4 pb-4 pt-3 lg:hidden"
          >
            <ConnectWallet block />
            <ul className="mt-3 divide-y divide-line">
              {NAV.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={pathname === l.href ? "page" : undefined}
                    className="block py-3 text-[13px] text-muted transition-colors hover:text-fg"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              {signedIn === true ? (
                <li>
                  <Link
                    href="/account"
                    className="block py-3 text-[13px] text-muted transition-colors hover:text-fg"
                  >
                    Your account
                  </Link>
                </li>
              ) : null}
            </ul>
          </nav>
        </>
      ) : null}
    </div>
  );
}
