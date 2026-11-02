"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * One anonymous page count per navigation — no cookie, no id, no user-agent,
 * which is why it needs no consent. See app/api/hit.
 */
export function PageViews() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    void fetch("/api/hit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
