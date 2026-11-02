"use client";

import { useEffect } from "react";

/**
 * Reports uncaught client errors to the server so they land in the container log
 * instead of only in one visitor's console. Deduplicated per session: the same
 * message is sent once, which keeps a broken dependency from flooding the API.
 */
export function ClientErrorReporter() {
  useEffect(() => {
    const seen = new Set<string>();

    const send = (kind: string, payload: Record<string, unknown>) => {
      const key = `${kind}:${String(payload.message ?? "").slice(0, 120)}`;
      if (seen.has(key)) return;
      seen.add(key);
      void fetch("/api/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          kind,
          path: window.location.pathname.slice(0, 120),
          ...payload,
        }),
      }).catch(() => {});
    };

    const onError = (e: ErrorEvent) => {
      send("error", {
        message: e.message,
        stack: (e.error as Error | undefined)?.stack?.slice(0, 2000) ?? "",
        source: e.filename,
        line: e.lineno,
        col: e.colno,
      });
    };

    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { name?: string; message?: string; stack?: string } | undefined;
      send("unhandledrejection", {
        message: `${r?.name ?? "Error"}: ${r?.message ?? String(e.reason)}`,
        stack: r?.stack?.slice(0, 2000) ?? "",
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
