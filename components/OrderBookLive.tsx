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

function short(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-3)}`;
}

function Price({ level, tone, max, onPick }: {
  level: Level;
  tone: "ask" | "bid";
  max: number;
  onPick: () => void;
}) {
  const pct = Math.max(3, (level.shares / max) * 100);
  return (
    <button
      type="button"
      onClick={onPick}
      title="Use this price in the trade panel"
      className="group relative flex h-8 w-full items-center justify-between px-4 text-[12.5px] transition-colors hover:bg-surface2/70"
    >
      <span
        className={`absolute inset-y-[3px] right-0 rounded-[3px] ${
          tone === "ask" ? "bg-no/10" : "bg-yes/10"
        } group-hover:opacity-70`}
        style={{ width: `${pct}%` }}
        aria-hidden="true"
      />
      <span className={`num relative font-medium ${tone === "ask" ? "text-no" : "text-yes"}`}>
        {(level.price * 100).toFixed(1)}¢
      </span>
      <span className="num relative w-16 text-right text-muted">{level.shares.toFixed(2)}</span>
      <span className="num relative w-14 text-right text-[11px] text-dim">{short(level.maker)}</span>
    </button>
  );
}

function Empty({ side }: { side: "ask" | "bid" }) {
  return (
    <div className="flex h-8 items-center justify-between px-4 text-[12px] text-dim/60">
      <span>—</span>
      <span className="w-16 text-right">—</span>
      <span className="w-14 text-right text-[11px]">{side === "ask" ? "no offer" : "no bid"}</span>
    </div>
  );
}

export function OrderBookLive() {
  const { account, ensureChain, walletClient } = useWallet();
  const { setPick, version, bump } = useTradeState();
  const [book, setBook] = useState<Book | null>(null);
  const [outcome, setOutcome] = useState<boolean>(true); // true = YES
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
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load, version]);

  const asks = (book?.asks ?? []).filter((l) => l.isYes === outcome);
  const bids = (book?.bids ?? []).filter((l) => l.isYes === outcome);
  // Show every order the wallet has, not just the outcome currently on screen —
  // otherwise your No orders vanish when you are looking at Yes.
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
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-semibold tracking-tight">Order book</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-[5px] border border-line p-0.5">
            {[true, false].map((side) => (
              <button
                key={String(side)}
                type="button"
                onClick={() => setOutcome(side)}
                className={`h-6 rounded-[3px] px-2.5 text-[11.5px] font-medium transition-colors ${
                  outcome === side
                    ? side
                      ? "bg-yes text-black"
                      : "bg-no text-black"
                    : "text-muted hover:text-fg"
                }`}
              >
                {side ? "Yes" : "No"}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-dim">{book?.count ?? 0} placed</span>
        </div>
      </header>

      <div className="flex justify-between px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-dim">
        <span>Price</span>
        <span className="w-16 text-right">Shares</span>
        <span className="w-14 text-right">Maker</span>
      </div>

      <div className="divide-y divide-line/50">
        {askSlots.map((l, i) =>
          l ? (
            <Price key={`a${l.id}`} level={l} tone="ask" max={max} onPick={() => pick(l)} />
          ) : (
            <Empty key={`ae${i}`} side="ask" />
          ),
        )}
      </div>

      <div className="flex items-center justify-between border-y border-line bg-surface2/60 px-4 py-2">
        <span className="text-[11px] text-dim">Spread</span>
        <span className="num text-[12px] font-medium text-fg">
          {bestAsk !== undefined && bestBid !== undefined
            ? `${((bestAsk - bestBid) * 100).toFixed(1)}¢`
            : "—"}
        </span>
      </div>

      <div className="divide-y divide-line/50">
        {bidSlots.map((l, i) =>
          l ? (
            <Price key={`b${l.id}`} level={l} tone="bid" max={max} onPick={() => pick(l)} />
          ) : (
            <Empty key={`be${i}`} side="bid" />
          ),
        )}
      </div>

      {asks.length === 0 && bids.length === 0 ? (
        <p className="border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-muted">
          Nothing resting on {outcome ? "Yes" : "No"} yet. Post an order from the panel and it
          will appear here.
        </p>
      ) : null}

      <footer className="border-t border-line px-4 py-2.5 text-[11px] text-dim">
        Click any price to load it into the trade panel.
      </footer>

      {mine.length > 0 ? (
        <div className="border-t border-line">
          <header className="px-4 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-dim">
            Your open orders
          </header>
          <ul className="divide-y divide-line/50">
            {mine.map((o) => (
              <li key={o.id} className="flex items-center justify-between px-4 py-2 text-[12px]">
                <span className="text-muted">
                  #{o.id} ·{" "}
                  <span className={o.isYes ? "text-yes" : "text-no"}>
                    {o.isYes ? "Yes" : "No"}
                  </span>{" "}
                  · <span className="num">{(o.price * 100).toFixed(1)}¢</span> ·{" "}
                  <span className="num">{o.shares.toFixed(2)}</span> sh
                </span>
                <button
                  type="button"
                  onClick={() => cancel(o.id)}
                  disabled={canceling === o.id}
                  className="rounded-[4px] border border-line px-2 py-1 text-[11px] text-muted transition-colors hover:border-line2 hover:text-fg disabled:opacity-40"
                >
                  {canceling === o.id ? "…" : "Cancel"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {note ? (
        <p aria-live="polite" className="border-t border-line px-4 py-2 text-[11px] text-dim">
          {note}
        </p>
      ) : null}
    </section>
  );
}
