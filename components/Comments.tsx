"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Comment = { id: string; body: string; at: string; name: string; yes: number; no: number };

const ERRORS: Record<string, string> = {
  language: "That contains language we don't allow here.",
  no_links: "Links aren't allowed in comments.",
  too_short: "A bit more than that.",
  too_long: "Keep it under 500 characters.",
  shouting: "Try not to shout.",
  spam: "That looks like spam.",
  rate_limited: "You're posting too fast. Wait a few minutes.",
  sign_in_required: "Sign in to comment.",
  accounts_unavailable: "Comments are temporarily unavailable.",
};

function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function Comments() {
  const [list, setList] = useState<Comment[]>([]);
  const [available, setAvailable] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback((p: number) => {
    setLoaded(false);
    return fetch(`/api/comments?page=${p}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { comments?: Comment[]; available?: boolean; pages?: number; total?: number }) => {
        setList(d.comments ?? []);
        setAvailable(d.available !== false);
        setPages(d.pages ?? 1);
        setTotal(d.total ?? (d.comments ?? []).length);
      })
      .catch(() => setAvailable(false))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { user?: unknown }) => alive && setSignedIn(Boolean(d.user)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; comment?: Comment };
      if (res.ok && data.ok && data.comment) {
        setText("");
        setPage(1);
        load(1);
        return;
      }
      setError(ERRORS[data.error ?? ""] ?? "That didn't post. Try again.");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-semibold tracking-tight">Discussion</h2>
        <span className="num text-[11px] text-dim">{total}</span>
      </header>

      <div className="p-4">
        {signedIn ? (
          <form onSubmit={submit}>
            <label htmlFor="comment" className="sr-only">
              Your comment
            </label>
            <textarea
              id="comment"
              value={text}
              maxLength={500}
              rows={3}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError("");
              }}
              placeholder="What do you think happens to the goat?"
              className="w-full resize-y rounded-btn border border-line bg-black px-3 py-2 text-[13px] text-fg outline-none focus:border-line2"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="num text-[11px] text-dim">{text.length}/500</span>
              <button
                type="submit"
                disabled={busy || text.trim().length < 2}
                className="h-8 rounded-btn bg-fg px-3.5 text-[12px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {busy ? "Posting…" : "Post"}
              </button>
            </div>
            {error ? <p className="mt-1.5 text-[12px] text-yes">{error}</p> : null}
          </form>
        ) : (
          <p className="text-[12.5px] text-muted">
            <Link href="/login" className="text-fg underline decoration-line2 underline-offset-2">
              Sign in
            </Link>{" "}
            to join the discussion. Comments are public and tied to an anonymous handle.
          </p>
        )}

        <ul className="mt-4 divide-y divide-line border-t border-line">
          {!loaded ? (
            <li className="py-3 text-[12px] text-dim">Loading…</li>
          ) : !available ? (
            <li className="py-3 text-[12px] text-dim">Comments are unavailable right now.</li>
          ) : list.length === 0 ? (
            <li className="py-3 text-[12px] text-dim">No comments yet.</li>
          ) : (
            list.map((c) => (
              <li key={c.id} className="py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-dim">
                  <span className="font-medium text-muted">{c.name}</span>
                  <span>·</span>
                  <span className="num">
                    <span className={c.yes > 0 ? "text-yes" : ""}>{c.yes.toFixed(2)} YES</span>
                    <span className="mx-1 text-line2">/</span>
                    <span className={c.no > 0 ? "text-no" : ""}>{c.no.toFixed(2)} NO</span>
                  </span>
                  <span>·</span>
                  <span>{ago(c.at)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-fg">
                  {c.body}
                </p>
              </li>
            ))
          )}
        </ul>

        {pages > 1 ? (
          <nav
            aria-label="Comment pages"
            className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[11.5px]"
          >
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-7 rounded-[5px] border border-line px-2.5 text-muted transition-colors hover:border-line2 hover:text-fg disabled:opacity-40"
            >
              Previous
            </button>
            <span className="num text-dim">
              Page {page} of {pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="h-7 rounded-[5px] border border-line px-2.5 text-muted transition-colors hover:border-line2 hover:text-fg disabled:opacity-40"
            >
              Next
            </button>
          </nav>
        ) : null}
      </div>
    </section>
  );
}
