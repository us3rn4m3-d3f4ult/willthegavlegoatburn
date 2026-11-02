"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TradePanel } from "@/components/TradePanel";
import { useTradeState } from "@/components/TradeProvider";
import { useSession } from "@/components/useSession";
import { useOrderBook } from "@/components/useOrderBook";

/** Sticky bar at the bottom of the screen on mobile; opens the panel as a sheet. */
export function MobileTradeBar() {
  const { pick, requestSide } = useTradeState();
  const signedIn = useSession();
  const { book } = useOrderBook();
  const [open, setOpen] = useState(false);

  // Tapping a price in the book should open the sheet on mobile.
  useEffect(() => {
    if (pick) setOpen(true);
  }, [pick]);

  // A sheet over the page: Esc closes it and the page behind must not scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const bestAsk = (book?.asks ?? [])
    .filter((l) => l.isYes)
    .sort((a, c) => a.price - c.price)[0];
  const bestBid = (book?.bids ?? [])
    .filter((l) => l.isYes)
    .sort((a, c) => c.price - a.price)[0];

  const yes = bestAsk && bestBid ? (bestAsk.price + bestBid.price) / 2 : (bestAsk?.price ?? bestBid?.price ?? 0.5);
  const yesC = (yes * 100).toFixed(1);
  const noC = ((1 - yes) * 100).toFixed(1);

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-black/95 px-3 pt-2 backdrop-blur lg:hidden"
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
      >
        {signedIn === false ? (
          <Link
            href="/login"
            className="flex h-11 items-center justify-center rounded-btn bg-fg text-[13px] font-semibold text-black"
          >
            Sign in to trade
          </Link>
        ) : null}
        <div className={signedIn === false ? "hidden" : "flex gap-2"}>
          <button
            type="button"
            onClick={() => {
              requestSide(true);
              setOpen(true);
            }}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-btn border border-yes/50 bg-yes/10 text-[13px] font-semibold text-yes"
          >
            Buy Yes <span className="num text-[11.5px] font-medium opacity-70">{yesC}¢</span>
          </button>
          <button
            type="button"
            onClick={() => {
              requestSide(false);
              setOpen(true);
            }}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-btn border border-no/50 bg-no/10 text-[13px] font-semibold text-no"
          >
            Buy No <span className="num text-[11.5px] font-medium opacity-70">{noC}¢</span>
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Trade">
          <button
            type="button"
            aria-label="Close trade panel"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/75"
          />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto overscroll-contain border-t border-line bg-black px-3 pt-3"
            style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="eyebrow">Trade</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 border border-line px-3 text-[11.5px] text-muted transition-colors hover:border-line2 hover:text-fg sm:h-8"
              >
                Close
              </button>
            </div>
            <TradePanel anchor={false} />
          </div>
        </div>
      ) : null}
    </>
  );
}
