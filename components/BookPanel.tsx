"use client";

import { useEffect, useState } from "react";

type Level = { id: number; price: number; shares: number; maker: string; isYes: boolean };
type Book = { configured: boolean; asks: Level[]; bids: Level[]; count?: number };

export function BookPanel() {
  const [book, setBook] = useState<Book | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch("/api/orders", { cache: "no-store" })
        .then((r) => r.json() as Promise<Book>)
        .then((d) => alive && setBook(d))
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const asks = book?.asks ?? [];
  const bids = book?.bids ?? [];
  const empty = asks.length === 0 && bids.length === 0;

  const row = (l: Level, tone: "ask" | "bid") => (
    <div key={l.id} className="flex items-center justify-between px-4 py-1.5 text-[12px]">
      <span className={`num font-medium ${tone === "ask" ? "text-no" : "text-yes"}`}>
        {(l.price * 100).toFixed(1)}c
      </span>
      <span className="num text-muted">{l.shares.toFixed(2)}</span>
      <span className="num text-dim">
        {l.maker.slice(0, 4)}…{l.maker.slice(-3)}
      </span>
    </div>
  );

  return (
    <section className="rounded-card border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-semibold tracking-tight">Order book</h2>
        <span className="text-[11px] text-dim">
          {book === null
            ? "\u2026"
            : book.configured
              ? `${book.count ?? 0} orders ever placed`
              : "not deployed"}
        </span>
      </header>

      {empty ? (
        <div className="px-4 py-5">
          <p className="text-[12.5px] leading-relaxed text-muted">
            No open orders. The book is empty, so there is nothing to fill yet — someone has
            to post the first offer.
          </p>
          <p className="mt-2 text-[11.5px] leading-relaxed text-dim">
            Meanwhile the AMM on the right always quotes a price, so trading still works.
          </p>
        </div>
      ) : (
        <>
          <div className="flex justify-between px-4 py-2 text-[10px] uppercase tracking-[0.1em] text-dim">
            <span>Price</span>
            <span>Shares</span>
            <span>Maker</span>
          </div>
          <div className="divide-y divide-line/60">{asks.map((a) => row(a, "ask"))}</div>
          {asks.length > 0 && bids.length > 0 ? (
            <div className="border-y border-line bg-surface2/60 px-4 py-1.5 text-center text-[10.5px] text-dim">
              spread {((asks[0].price - bids[0].price) * 100).toFixed(1)}c
            </div>
          ) : null}
          <div className="divide-y divide-line/60">{bids.map((b) => row(b, "bid"))}</div>
        </>
      )}
    </section>
  );
}
