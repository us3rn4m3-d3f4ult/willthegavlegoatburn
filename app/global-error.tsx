"use client";

import { useEffect } from "react";

/**
 * Last line of defence: the root layout itself failed, so there is no site chrome
 * to fall back on. Report the error, then offer the one action that actually fixes
 * the usual cause — a page from a previous build.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        kind: "global-error",
        message: error.message,
        stack: error.stack?.slice(0, 2000) ?? "",
        digest: error.digest ?? "",
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#000",
          color: "#f2f2f2",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <main style={{ maxWidth: 520, margin: "0 auto", padding: "18vh 24px" }}>
          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#5c5c5c",
              margin: 0,
            }}
          >
            Something broke
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", margin: "14px 0 0" }}>
            This page failed to load.
          </h1>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: "#909090", marginTop: 14 }}>
            Usually a leftover copy of the site from before an update. Reloading fetches the
            current version.
          </p>
          {error.digest ? (
            <p style={{ fontSize: 11, color: "#5c5c5c", marginTop: 12 }}>Reference: {error.digest}</p>
          ) : null}
          <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                height: 38,
                padding: "0 18px",
                border: "1px solid #f2f2f2",
                borderRadius: 2,
                background: "#f2f2f2",
                color: "#000",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
            <button
              onClick={reset}
              style={{
                height: 38,
                padding: "0 18px",
                border: "1px solid #333",
                borderRadius: 2,
                background: "transparent",
                color: "#f2f2f2",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
