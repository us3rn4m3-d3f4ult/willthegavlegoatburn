"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TradePanel } from "@/components/TradePanel";
import { useTradeState } from "@/components/TradeProvider";
import { useSession } from "@/components/useSession";

type Book = { asks: { price: number; isYes: boolean }[]; bids: { price: number; isYes: boolean }[] };

/** Sticky bar at the bottom of the screen on mobile; opens the panel as a sheet. */
export function MobileTradeBar() {
  const { pick, requestSide } = useTradeState();
  const signedIn = useSession();
  const [open, setOpen] = useState(false);
  const [yes, setYes] = useState(0.5);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch("/api/orders", { cache: "no-store" })
        .then((r) => r.json() as Promise<Book>)
        .then((b) => {
          if (!alive) return;
          const ask = (b.asks ?? []).filter((l) => l.isYes).sort((a, c) => a.price - c.price)[0];
          const bid = (b.bids ?? []).filter((l) => l.isYes).sort((a, c) => c.price - a.price)[0];
          if (ask && bid) setYes((ask.price + bid.price) / 2);
          else if (ask) setYes(ask.price);
          else if (bid) setYes(bid.price);
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // Tapping a price in the book should open the sheet on mobile.
  useEffect(() => {
    if (pick) setOpen(true);
  }, [pick]);

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
            href="/register"
            className="flex h-11 items-center justify-center rounded-btn bg-fg text-[13px] font-semibold text-black"
          >
            Register to trade
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
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close trade panel"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/75"
          />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto border-t border-line bg-black px-3 pt-3"
            style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="eyebrow">Trade</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-7 border border-line px-2.5 text-[11.5px] text-muted"
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
