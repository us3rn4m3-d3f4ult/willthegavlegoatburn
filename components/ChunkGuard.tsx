"use client";

import { useEffect } from "react";

/**
 * A deploy replaces the hashed JS chunks that the previous build's HTML points
 * at. Any tab that survives a deploy then fails to load a chunk and React shows
 * "Application error: a client-side exception has occurred".
 *
 * The real fix is cache headers (documents are no-store, build output is
 * immutable), but this recovers the tabs that are already out there: one reload
 * picks up the matching build, and a session flag prevents a reload loop if the
 * server itself is broken.
 */
export function ChunkGuard() {
  useEffect(() => {
    const reloadOnce = () => {
      if (sessionStorage.getItem("chunk-reload") === "1") return;
      sessionStorage.setItem("chunk-reload", "1");
      // A plain reload can be served straight from the disk cache and fail again.
      // Changing the query string forces a network fetch of the document itself.
      const url = new URL(window.location.href);
      url.searchParams.set("_r", String(Date.now()));
      window.location.replace(url.toString());
    };

    const isChunkFailure = (text: string) =>
      /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
        text,
      );

    const onError = (e: ErrorEvent) => {
      if (isChunkFailure(String(e.message ?? ""))) reloadOnce();
    };

    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason as { name?: string; message?: string } | undefined;
      if (isChunkFailure(`${reason?.name ?? ""} ${reason?.message ?? ""}`)) reloadOnce();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    // If the page has been healthy for a while, allow a future reload to help.
    const t = setTimeout(() => sessionStorage.removeItem("chunk-reload"), 30_000);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      clearTimeout(t);
    };
  }, []);

  return null;
}
