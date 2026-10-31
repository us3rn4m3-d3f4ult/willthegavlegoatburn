"use client";

import { useCallback, useEffect, useState } from "react";
import { BOOK_ABI, BOOK_ADDRESS, chain, publicClient } from "@/lib/web3";
import type { Level } from "@/lib/book";
import { useWallet } from "@/components/WalletProvider";
import { useTradeState } from "@/components/TradeProvider";

type Book = {
  configured: boolean;
  trading?: boolean;
  asks: Level[];
  bids: Level[];
  mine: Level[];
  count?: number;
};

const ROWS = 4;

function Row({
  level,
  tone,
  max,
  onPick,
}: {
  level: Level;
  tone: "ask" | "bid";
  max: number;
  onPick: () => void;
}) {
  const pct = Math.max(4, (level.shares / max) * 100);
  return (
    <button
      type="button"
      onClick={onPick}
      className="relative flex h-9 w-full items-center gap-4 px-4 text-[12.5px] transition-colors hover:bg-surface2"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 right-0 ${tone === "ask" ? "bg-no/[0.08]" : "bg-yes/[0.08]"}`}
        style={{ width: `${pct}%` }}
      />
      <span className={`num relative font-medium ${tone === "ask" ? "text-no" : "text-yes"}`}>
        {(level.price * 100).toFixed(1)}¢
      </span>
      <span className="num relative ml-auto text-muted">{level.shares.toFixed(2)}</span>
    </button>
  );
}

function Empty() {
  return (
    <div className="flex h-9 items-center gap-4 px-4 text-[12.5px] text-dim">
      <span>—</span>
      <span className="ml-auto">—</span>
    </div>
  );
}

export function OrderBookLive() {
  const { account, ensureChain, walletClient } = useWallet();
  const { setPick, version, bump } = useTradeState();
  const [book, setBook] = useState<Book | null>(null);
  const [outcome, setOutcome] = useState<boolean>(true);
  const [canceling, setCanceling] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    const q = account ? `?maker=${account.toLowerCase()}` : "";
    fetch(`/api/orders${q}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<Book>)
      .then(setBook)
      .catch(() => {});
  }, [account]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5_000);
    return () => clearInterval(t);
  }, [load, version]);

  const asks = (book?.asks ?? []).filter((l) => l.isYes === outcome);
  const bids = (book?.bids ?? []).filter((l) => l.isYes === outcome);
  const mine = book?.mine ?? [];

  const bestAsk = asks[0]?.price;
  const bestBid = bids[0]?.price;
  const max = Math.max(0.000001, ...asks.map((a) => a.shares), ...bids.map((b) => b.shares));

  // Best ask sits just above the spread, worst at the top; bids mirror it downwards.
  const askSlots: (Level | null)[] = [
    ...Array<null>(Math.max(0, ROWS - asks.length)).fill(null),
    ...asks.slice(0, ROWS).reverse(),
  ];
  const bidSlots: (Level | null)[] = [
    ...bids.slice(0, ROWS),
    ...Array<null>(Math.max(0, ROWS - bids.length)).fill(null),
  ];

  const pick = (level: Level) => {
    setPick({ price: level.price, isYes: level.isYes });
    document.getElementById("trade-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  async function cancel(id: number) {
    if (!account || !(await ensureChain())) return;
    const wc = walletClient();
    if (!wc) return;
    setCanceling(id);
    setNote("Confirm the cancel in your wallet…");
    try {
      const hash = await wc.writeContract({
        address: BOOK_ADDRESS,
        abi: BOOK_ABI,
        functionName: "cancelOrder",
        args: [BigInt(id)],
        chain,
        account,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setNote("Order cancelled.");
      bump();
    } catch {
      setNote("Cancel rejected.");
    } finally {
      setCanceling(null);
    }
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">Order book</h2>
        <div className="flex rounded-btn border border-line" role="tablist">
          {[true, false].map((side) => (
            <button
              key={String(side)}
              type="button"
              role="tab"
              aria-selected={outcome === side}
              onClick={() => setOutcome(side)}
              className={`h-7 px-3 text-[12px] font-medium transition-colors ${
                outcome === side ? (side ? "text-yes" : "text-no") : "text-dim hover:text-muted"
              }`}
            >
              {side ? "Yes" : "No"}
            </button>
          ))}
        </div>
      </header>

      <div className="flex items-center gap-4 border-b border-line px-4 py-2">
        <span className="eyebrow">Price</span>
        <span className="eyebrow ml-auto">Shares</span>
      </div>

      <div>
        {askSlots.map((l, i) =>
          l ? (
            <Row key={`a${l.id}`} level={l} tone="ask" max={max} onPick={() => pick(l)} />
          ) : (
            <Empty key={`ae${i}`} />
          ),
        )}
      </div>

      <div className="flex items-center justify-between border-y border-line bg-surface2 px-4 py-2">
        <span className="eyebrow">Spread</span>
        <span className="num text-[12.5px] text-fg">
          {bestAsk !== undefined && bestBid !== undefined
            ? `${((bestAsk - bestBid) * 100).toFixed(1)}¢`
            : "—"}
        </span>
      </div>

      <div>
        {bidSlots.map((l, i) =>
          l ? (
            <Row key={`b${l.id}`} level={l} tone="bid" max={max} onPick={() => pick(l)} />
          ) : (
            <Empty key={`be${i}`} />
          ),
        )}
      </div>

      {asks.length === 0 && bids.length === 0 ? (
        <p className="border-t border-line px-4 py-3 text-[12.5px] text-muted">Nothing resting.</p>
      ) : null}

      {mine.length > 0 ? (
        <div className="border-t border-line">
          <p className="eyebrow px-4 pb-1 pt-3">Your orders</p>
          <ul className="divide-y divide-line">
            {mine.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-4 py-2 text-[12.5px]">
                <span className="num text-dim">#{o.id}</span>
                <span className={o.isYes ? "text-yes" : "text-no"}>{o.isYes ? "Yes" : "No"}</span>
                <span className="num text-muted">{(o.price * 100).toFixed(1)}¢</span>
                <span className="num text-muted">{o.shares.toFixed(2)}</span>
                <button
                  type="button"
                  onClick={() => cancel(o.id)}
                  disabled={canceling === o.id}
                  className="ml-auto text-[11.5px] text-dim transition-colors hover:text-fg disabled:opacity-40"
                >
                  {canceling === o.id ? "…" : "Cancel"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {note ? (
        <p aria-live="polite" className="border-t border-line px-4 py-2 text-[11.5px] text-dim">
          {note}
        </p>
      ) : null}
    </section>
  );
}
