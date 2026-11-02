"use client";

import { useEffect, useState } from "react";

/**
 * Whether the visitor has an account — one request for the whole tab.
 *
 * `null` while the first check is in flight, so callers can avoid flashing the
 * wrong call-to-action. The result is shared: `WalletProvider`, the trade panel,
 * the mobile bar, the composer and the balance panels all read this same value
 * instead of each firing `/api/auth/me` on mount.
 *
 * `setSession()` pushes a known result (sign in, sign out, delete, recovery) to
 * every mounted hook immediately, so nothing keeps rendering signed-in UI after
 * a sign-out.
 */
let cached: boolean | null = null;
let cachedEmail: string | null = null;
let checkedAt = 0;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

const FRESH_MS = 30_000;

type Me = { user?: { email?: string } | null };

function emit(): void {
  for (const notify of listeners) notify();
}

function check(): Promise<void> {
  if (inflight) return inflight;
  inflight = fetch("/api/auth/me", { cache: "no-store" })
    .then((r) => r.json() as Promise<Me>)
    .then((d) => {
      cached = Boolean(d.user);
      cachedEmail = d.user?.email ?? null;
      checkedAt = Date.now();
    })
    .catch(() => {
      // Leave the last known answer: a network blip is not a sign-out.
    })
    .finally(() => {
      inflight = null;
      emit();
    });
  return inflight;
}

/** Update the cache from an auth flow and tell every mounted hook. */
export function setSession(signedIn: boolean | null): void {
  cached = signedIn;
  cachedEmail = null;
  checkedAt = Date.now();
  emit();
}

export function useSession(): boolean | null {
  const [signedIn, setSignedIn] = useState<boolean | null>(cached);

  useEffect(() => {
    let alive = true;
    const notify = () => {
      if (alive) setSignedIn(cached);
    };
    listeners.add(notify);

    if (Date.now() - checkedAt > FRESH_MS) void check();

    // A tab can outlive its session (30 days, or a sign-out elsewhere).
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - checkedAt > FRESH_MS) {
        void check();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      listeners.delete(notify);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return signedIn;
}

/** The same answer, plus the email the header avatar is seeded from. */
export function useSessionUser(): { signedIn: boolean | null; email: string | null } {
  const signedIn = useSession();
  const [email, setEmail] = useState<string | null>(cachedEmail);

  useEffect(() => {
    let alive = true;
    const notify = () => {
      if (alive) setEmail(cachedEmail);
    };
    listeners.add(notify);
    return () => {
      alive = false;
      listeners.delete(notify);
    };
  }, []);

  return { signedIn, email };
}
