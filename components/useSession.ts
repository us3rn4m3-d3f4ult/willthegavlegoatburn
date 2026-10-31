"use client";

import { useEffect, useState } from "react";

/**
 * Whether the visitor has an account. `null` while the check is in flight, so
 * callers can avoid flashing the wrong call-to-action.
 */
let cached: boolean | null = null;

export function useSession(): boolean | null {
  const [signedIn, setSignedIn] = useState<boolean | null>(cached);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ user?: unknown }>)
      .then((d) => {
        cached = Boolean(d.user);
        if (alive) setSignedIn(cached);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return signedIn;
}
