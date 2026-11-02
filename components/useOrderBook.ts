"use client";

import { useEffect, useState } from "react";

/**
 * One shared order book for the whole tab.
 *
 * The book used to be fetched by four components on their own timers (5s, 15s,
 * 20s, 20s), so a single visitor could hit `/api/orders` several times a minute
 * for the same data. Now there is one poll, one cache, and components subscribe.
 */

export type BookLevel = {
  id: number;
  price: number;
  shares: number;
  maker: string;
  isYes: boolean;
  /** Only set on `mine`: a resting ask escrows shares, a bid escrows USDC. */
  isAsk?: boolean;
};

export type Book = {
  configured: boolean;
  trading?: boolean;
  asks: BookLevel[];
  bids: BookLevel[];
  mine: BookLevel[];
  count?: number;
  error?: string;
};

const POLL_MS = 6_000;

let book: Book | null = null;
let failed = false;
let updatedAt = 0;
let maker = "";
let timer: ReturnType<typeof setInterval> | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const notify of listeners) notify();
}

async function fetchBook(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(`/api/orders${maker ? `?maker=${maker}` : ""}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as Book;
      book = data;
      failed = Boolean(data.error);
      updatedAt = Date.now();
    } catch {
      failed = true;
    } finally {
      inflight = null;
      emit();
    }
  })();
  return inflight;
}

/** Ask for a fresh read now — used after placing or cancelling an order. */
export function refreshBook(): void {
  void fetchBook();
}

export function useOrderBook(account?: string | null) {
  const [, rerender] = useState(0);

  useEffect(() => {
    const next = account ? account.toLowerCase() : "";
    if (next !== maker) {
      // A different wallet: what is cached belongs to someone else.
      maker = next;
      book = null;
      failed = false;
      void fetchBook();
    } else if (!book) {
      void fetchBook();
    }

    const notify = () => rerender((n) => n + 1);
    listeners.add(notify);
    if (!timer) timer = setInterval(() => void fetchBook(), POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchBook();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      listeners.delete(notify);
      document.removeEventListener("visibilitychange", onVisible);
      if (listeners.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, [account]);

  return { book, failed, updatedAt };
}
