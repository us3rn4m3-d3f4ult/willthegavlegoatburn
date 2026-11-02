"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Route-level boundary: keeps the header and footer, reports the error. */
export default function Error({
  error,
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
        kind: "route-error",
        message: error.message,
        stack: error.stack?.slice(0, 2000) ?? "",
        digest: error.digest ?? "",
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="mx-auto max-w-[52ch] py-20">
      <p className="eyebrow">Something broke</p>
      <h1 className="mt-3 text-[24px] font-semibold tracking-[-0.02em] text-fg">
        This page failed to load.
      </h1>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        Usually a leftover copy of the site from before an update. Reloading fetches the current
        version; the market itself is unaffected and still readable from the home page.
      </p>
      {error.digest ? (
        <p className="num mt-3 text-[11px] text-dim">Reference: {error.digest}</p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn btn-primary h-9 px-4"
        >
          Reload the page
        </button>
        <Link href="/" className="text-[12.5px] text-muted transition-colors hover:text-fg">
          Back to the market
        </Link>
      </div>
    </div>
  );
}
