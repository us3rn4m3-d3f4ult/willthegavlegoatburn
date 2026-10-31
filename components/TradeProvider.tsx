"use client";

import { createContext, useContext, useMemo, useState } from "react";

/**
 * Shared state between the order book and the trade panel: clicking a price in the
 * book fills in the limit price, and placing/filling an order tells the book to
 * refresh immediately instead of waiting for the next poll.
 */
export type Pick = { price: number; isYes: boolean } | null;

/** A request from the mobile bar to open the panel on a given side. */
export type SideRequest = { isYes: boolean; n: number } | null;

type TradeCtx = {
  pick: Pick;
  setPick: (p: Pick) => void;
  version: number;
  bump: () => void;
  sideRequest: SideRequest;
  requestSide: (isYes: boolean) => void;
};

const Ctx = createContext<TradeCtx | null>(null);

export function TradeProvider({ children }: { children: React.ReactNode }) {
  const [pick, setPick] = useState<Pick>(null);
  const [version, setVersion] = useState(0);
  const [sideRequest, setSideRequest] = useState<SideRequest>(null);

  const value = useMemo<TradeCtx>(
    () => ({
      pick,
      setPick,
      version,
      bump: () => setVersion((v) => v + 1),
      sideRequest,
      requestSide: (isYes: boolean) => setSideRequest({ isYes, n: Date.now() }),
    }),
    [pick, version, sideRequest],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTradeState(): TradeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTradeState must be used inside TradeProvider");
  return ctx;
}
