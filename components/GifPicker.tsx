"use client";

import { useEffect, useState } from "react";
import { searchGifs, type Gif } from "@/lib/gifs";

/**
 * The GIPHY search panel that sits under the comment box.
 *
 * Searches are debounced and cached (`searchGifs`) because the free key is rate
 * limited, and results are previewed from the same 200 px rendition the comment
 * renders — what you pick is what gets posted.
 */
export function GifPicker({
  onPick,
  onClose,
}: {
  onPick: (gif: Gif) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<Gif[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setGifs(null);
      setBusy(false);
      setError("");
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    // 350ms after the last keystroke, not on every key: each search is a call
    // against a rate-limited key.
    const timer = setTimeout(() => {
      setBusy(true);
      setError("");
      searchGifs(term, controller.signal)
        .then((found) => {
          if (!cancelled) setGifs(found);
        })
        .catch((err: unknown) => {
          if (cancelled || (err as { name?: string } | null)?.name === "AbortError") return;
          setGifs([]);
          setError("GIPHY did not answer. Try again in a moment.");
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="mt-2 border border-line p-2">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            // Never let Enter in the search box submit the comment form around it.
            if (e.key === "Enter") e.preventDefault();
          }}
          maxLength={50}
          placeholder="Search GIPHY"
          aria-label="Search GIPHY"
          className="h-8 min-w-0 flex-1 rounded-btn border border-line bg-black px-2.5 text-[12.5px] text-fg outline-none placeholder:text-dim focus:border-line2"
        />
        <button
          type="button"
          onClick={onClose}
          className="h-10 shrink-0 border border-line px-2.5 text-[11.5px] text-muted transition-colors hover:border-line2 hover:text-fg sm:h-8"
        >
          Close
        </button>
      </div>

      <div className="mt-2 max-h-[232px] overflow-y-auto">
        {busy ? (
          <p className="py-3 text-[11.5px] text-dim">Searching…</p>
        ) : error ? (
          <p className="py-3 text-[11.5px] text-no">{error}</p>
        ) : gifs === null ? (
          <p className="py-3 text-[11.5px] text-dim">Type at least two letters.</p>
        ) : gifs.length === 0 ? (
          <p className="py-3 text-[11.5px] text-dim">Nothing found for that.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-1">
            {gifs.map((gif) => (
              <li key={gif.url}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(gif);
                    onClose();
                  }}
                  className="block w-full overflow-hidden border border-line transition-colors hover:border-line2"
                  title={gif.alt}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gif.url}
                    alt={gif.alt}
                    width={gif.width}
                    height={gif.height}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* GIPHY's API terms require attribution wherever their content is searched. */}
      <p className="mt-2 text-[10.5px] text-dim">
        Powered by{" "}
        <a
          href="https://giphy.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-line2 underline-offset-2 hover:text-muted"
        >
          GIPHY
        </a>
      </p>
    </div>
  );
}
