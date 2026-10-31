"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BOOK_ABI,
  BOOK_ADDRESS,
  BOOK_CONFIGURED,
  ERC20_ABI,
  USDC_ADDRESS,
  chain,
  publicClient,
} from "@/lib/web3";
import { centsToWei, planBuy, planSell, type Level } from "@/lib/book";
import { units } from "@/lib/book";
import { useWallet } from "@/components/WalletProvider";
import { useTradeState } from "@/components/TradeProvider";

type Mode = "market" | "limit";
type Action = "buy" | "sell";
type Book = { asks: Level[]; bids: Level[]; mine: Level[]; trading?: boolean };
type Balances = { usdc: number; freeYes: number; freeNo: number };

type Tracked = { id: number; shares: number; price: number; isYes: boolean; isAsk: boolean };

function FillBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-dim">Fill</span>
        <span className="num text-muted">{label}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
        <div
          className="h-full rounded-full bg-ember transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function TradePanel({
  mid: fallbackMid = 0.5,
  anchor = true,
}: {
  mid?: number;
  anchor?: boolean;
}) {
  const { account, connect, ensureChain, walletClient } = useWallet();
  const { pick, bump, version, sideRequest } = useTradeState();

  const [isYes, setIsYes] = useState(true);
  const [action, setAction] = useState<Action>("buy");
  const [mode, setMode] = useState<Mode>("market");
  const [amount, setAmount] = useState("25");
  const [priceCents, setPriceCents] = useState("50.0");
  const [book, setBook] = useState<Book | null>(null);
  const [bal, setBal] = useState<Balances>({ usdc: 0, freeYes: 0, freeNo: 0 });
  const [expiresAt, setExpiresAt] = useState<bigint | null>(null);
  const [tracked, setTracked] = useState<Tracked[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [fill, setFill] = useState<{ value: number; label: string } | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  // Signed in = has a site account. A connected wallet alone is not enough.
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ user?: unknown }>)
      .then((d) => alive && setSignedIn(Boolean(d.user)))
      .catch(() => alive && setSignedIn(null));
    return () => {
      alive = false;
    };
  }, []);

  // Clicking a price in the book loads it here as a limit price.
  useEffect(() => {
    if (!pick) return;
    setMode("limit");
    setIsYes(pick.isYes);
    setPriceCents((pick.price * 100).toFixed(1));
    setStatus("");
  }, [pick]);

  // Tapping Buy Yes / Buy No in the mobile bar.
  useEffect(() => {
    if (!sideRequest) return;
    setIsYes(sideRequest.isYes);
    setMode("market");
    setAction("buy");
    setStatus("");
  }, [sideRequest]);

  const loadBook = useCallback(() => {
    const q = account ? `?maker=${account.toLowerCase()}` : "";
    fetch(`/api/orders${q}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<Book>)
      .then(setBook)
      .catch(() => {});
  }, [account]);

  const loadBalances = useCallback(async () => {
    if (!account || !BOOK_CONFIGURED) return;
    try {
      const [usdc, fy, fn] = await Promise.all([
        publicClient.readContract({
          address: BOOK_ADDRESS,
          abi: BOOK_ABI,
          functionName: "usdcBalance",
          args: [account],
        }),
        publicClient.readContract({
          address: BOOK_ADDRESS,
          abi: BOOK_ABI,
          functionName: "freeShares",
          args: [account, true],
        }),
        publicClient.readContract({
          address: BOOK_ADDRESS,
          abi: BOOK_ABI,
          functionName: "freeShares",
          args: [account, false],
        }),
      ]);
      setBal({
        usdc: Number(usdc as bigint) / 1e6,
        freeYes: Number(fy as bigint) / 1e6,
        freeNo: Number(fn as bigint) / 1e6,
      });
    } catch {
      /* keep the last known numbers */
    }
  }, [account]);

  useEffect(() => {
    loadBook();
    const t = setInterval(loadBook, 15_000);
    return () => clearInterval(t);
  }, [loadBook, version]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances, version]);

  useEffect(() => {
    if (!BOOK_CONFIGURED) return;
    publicClient
      .readContract({ address: BOOK_ADDRESS, abi: BOOK_ABI, functionName: "bettingClosesAt" })
      .then((v) => setExpiresAt(v as bigint))
      .catch(() => {});
  }, []);

  const asks = (book?.asks ?? []).filter((l) => l.isYes === isYes);
  const bids = (book?.bids ?? []).filter((l) => l.isYes === isYes);
  const bestAsk = asks[0]?.price;
  const bestBid = bids[0]?.price;

  const value = Number(amount) || 0;
  const limitPrice = Math.min(100, Math.max(0, Number(priceCents) || 0)) / 100;

  const plan = useMemo(() => {
    if (mode !== "market") return null;
    return action === "buy" ? planBuy(asks, value) : planSell(bids, value);
  }, [mode, action, asks, bids, value]);

  // Market buy spends USDC, market sell sells shares; limit orders are always in shares.
  const sharesWanted = mode === "market" && action === "buy" ? (plan?.shares ?? 0) : value;
  const usdcNeeded =
    mode === "market" && action === "buy"
      ? (plan?.cost ?? 0)
      : action === "buy"
        ? value * limitPrice
        : 0;

  const shortUsdc = Math.max(0, usdcNeeded - bal.usdc + 1e-9);
  const shortShares = action === "sell" ? Math.max(0, sharesWanted - (isYes ? bal.freeYes : bal.freeNo)) : 0;

  const midPrice =
    bestAsk !== undefined && bestBid !== undefined ? (bestAsk + bestBid) / 2 : fallbackMid;
  const shownPrice = isYes ? midPrice : 1 - midPrice;

  async function fundUsdc(need: number): Promise<boolean> {
    const w = walletClient();
    if (!w || !account) return false;
    const amt = units(need);
    const allowance = (await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [account, BOOK_ADDRESS],
    })) as bigint;

    if (allowance < amt) {
      setStatus("Approve USDC in your wallet…");
      const h = await w.writeContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [BOOK_ADDRESS, amt],
        chain,
        account,
      });
      await publicClient.waitForTransactionReceipt({ hash: h });
    }

    setStatus(`Deposit ${need.toFixed(2)} USDC into the market…`);
    const h2 = await w.writeContract({
      address: BOOK_ADDRESS,
      abi: BOOK_ABI,
      functionName: "deposit",
      args: [amt],
      chain,
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash: h2 });
    return true;
  }

  /** Selling needs shares, and shares come from splitting USDC 1:1. */
  async function mintShares(need: number): Promise<boolean> {
    const w = walletClient();
    if (!w || !account) return false;
    const shortUsdcForSplit = Math.max(0, need - bal.usdc);
    if (shortUsdcForSplit > 1e-9 && !(await fundUsdc(shortUsdcForSplit))) return false;

    setStatus(`Split ${need.toFixed(2)} USDC into Yes and No shares…`);
    const h = await w.writeContract({
      address: BOOK_ADDRESS,
      abi: BOOK_ABI,
      functionName: "split",
      args: [units(need)],
      chain,
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash: h });
    return true;
  }

  async function runMarket() {
    const w = walletClient();
    if (!w || !account || !plan || plan.steps.length === 0) return;

    if (action === "buy" && shortUsdc > 1e-9) {
      setFill({ value: 0, label: "funding" });
      if (!(await fundUsdc(shortUsdc))) return;
    }
    if (action === "sell" && shortShares > 1e-9) {
      setFill({ value: 0, label: "getting shares" });
      if (!(await mintShares(shortShares))) return;
    }

    let done = 0;
    const legs = plan.steps.length;
    for (const step of plan.steps) {
      setStatus(
        `${done + 1}/${legs}: ${step.shares.toFixed(2)} @ ${(step.price * 100).toFixed(1)}¢…`,
      );
      const h = await w.writeContract({
        address: BOOK_ADDRESS,
        abi: BOOK_ABI,
        functionName: action === "buy" ? "fillAsk" : "fillBid",
        args: [BigInt(step.id), units(step.shares)],
        chain,
        account,
      });
      await publicClient.waitForTransactionReceipt({ hash: h });
      done += 1;
      setFill({
        value: done / legs,
        label: `${done}/${legs} legs · ${plan.shares.toFixed(2)} sh`,
      });
    }

    setStatus(
      action === "buy"
        ? `Bought ${plan.shares.toFixed(2)} ${isYes ? "Yes" : "No"} for ${plan.cost.toFixed(2)} USDC.`
        : `Sold ${plan.shares.toFixed(2)} shares for ${plan.cost.toFixed(2)} USDC.`,
    );
    bump();
    void loadBalances();
  }

  async function placeLimit() {
    const w = walletClient();
    if (!w || !account || !expiresAt) return;

    if (action === "buy" && shortUsdc > 1e-9) {
      setFill({ value: 0, label: "funding" });
      if (!(await fundUsdc(shortUsdc))) return;
    }
    if (action === "sell" && shortShares > 1e-9) {
      setFill({ value: 0, label: "getting shares" });
      if (!(await mintShares(shortShares))) return;
    }

    setStatus(`Placing ${action === "buy" ? "bid" : "ask"} at ${Number(priceCents).toFixed(1)}¢…`);
    const h = await w.writeContract({
      address: BOOK_ADDRESS,
      abi: BOOK_ABI,
      functionName: action === "buy" ? "placeBid" : "placeAsk",
      args: [isYes, units(value), centsToWei(Number(priceCents)), expiresAt],
      chain,
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash: h });

    const next = (await publicClient.readContract({
      address: BOOK_ADDRESS,
      abi: BOOK_ABI,
      functionName: "nextOrderId",
    })) as bigint;

    setTracked((t) => [
      { id: Number(next) - 1, shares: value, price: limitPrice, isYes, isAsk: action === "sell" },
      ...t,
    ]);
    setFill({ value: 0, label: "0% filled · resting" });
    setStatus(
      `${action === "buy" ? "Bid" : "Ask"} placed for ${value.toFixed(2)} shares at ${Number(priceCents).toFixed(1)}¢. It waits in the book until someone takes it.`,
    );
    bump();
    void loadBalances();
  }

  async function submit() {
    if (!BOOK_CONFIGURED) {
      setStatus("No order book deployed yet.");
      return;
    }
    if (!account) {
      await connect();
      return;
    }
    if (!(await ensureChain())) {
      setStatus("Switch network in your wallet first.");
      return;
    }
    if (!(value > 0)) {
      setStatus(mode === "market" && action === "buy" ? "Enter a USDC amount." : "Enter a share amount.");
      return;
    }
    // The contract rejects anything under MIN_ORDER_SHARES (1 share) — check here so
    // the user is told before they sign, not after.
    if (mode === "limit" && value < 1) {
      setStatus("The smallest order is 1 share.");
      return;
    }
    if (mode === "market" && (action === "sell" ? value : (plan?.shares ?? 0)) < 1) {
      setStatus("That size is under 1 share — raise the amount.");
      return;
    }

    setBusy(true);
    setStatus("");
    setFill(null);
    try {
      if (mode === "market") await runMarket();
      else await placeLimit();
    } catch (err) {
      const msg = (err as { shortMessage?: string }).shortMessage ?? "";
      setStatus(msg ? `Failed: ${msg}` : "Transaction rejected or failed.");
    } finally {
      setBusy(false);
    }
  }

  // Fill bar for resting orders: compare what is still in the book to what was placed.
  async function withdrawAll() {
    const w = walletClient();
    if (!w || !account || bal.usdc <= 0 || !(await ensureChain())) return;
    setBusy(true);
    setStatus("Withdrawing USDC to your wallet…");
    try {
      const h = await w.writeContract({
        address: BOOK_ADDRESS,
        abi: BOOK_ABI,
        functionName: "withdraw",
        args: [units(bal.usdc)],
        chain,
        account,
      });
      await publicClient.waitForTransactionReceipt({ hash: h });
      setStatus("Withdrawn.");
      void loadBalances();
    } catch {
      setStatus("Withdraw rejected.");
    } finally {
      setBusy(false);
    }
  }

  // Fill bar for resting orders: compare what is still in the book to what was placed.
  const restingFills = tracked
    .filter((t) => t.isYes === isYes)
    .map((t) => {
      const live = (book?.mine ?? []).find((o) => o.id === t.id);
      const remaining = live ? live.shares : 0;
      return { ...t, filled: live ? Math.min(1, 1 - remaining / t.shares) : 1, live: Boolean(live) };
    });

  const noLiquidity = mode === "market" && (plan?.steps.length ?? 0) === 0;

  const unitLabel = mode === "market" && action === "buy" ? "USDC" : "shares";
  const label = !BOOK_CONFIGURED
    ? "Market not deployed"
    : !account
      ? "Connect wallet to trade"
      : busy
        ? "Working…"
        : mode === "market"
          ? `${action === "buy" ? "Buy" : "Sell"} ${isYes ? "Yes" : "No"} at market`
          : `${action === "buy" ? "Place bid" : "Place ask"} · ${Number(priceCents).toFixed(1)}¢`;

  return (
    <section
      id={anchor ? "trade-panel" : undefined}
      className="scroll-mt-24 rounded-card border border-line bg-surface p-4"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold tracking-tight">Trade</h2>
        <span className="text-[11px] text-dim">
          {mode === "market" ? "fills against the book" : "rests in the book"}
        </span>
      </div>

      <fieldset className="mt-3">
        <legend className="sr-only">Which side</legend>
        <div className="grid grid-cols-2 gap-2">
          {([true, false] as const).map((yesSide) => {
            const best = yesSide ? bestAsk : bestBid;
            return (
              <button
                key={String(yesSide)}
                type="button"
                aria-pressed={isYes === yesSide}
                onClick={() => {
                  setIsYes(yesSide);
                  setStatus("");
                }}
                className={`flex h-10 flex-col items-center justify-center rounded-btn text-[12.5px] font-semibold transition-colors ${
                  isYes === yesSide
                    ? yesSide
                      ? "bg-yes text-black"
                      : "bg-no text-black"
                    : "bg-surface2 text-muted hover:text-fg"
                }`}
              >
                <span>{yesSide ? "Yes" : "No"}</span>
                <span className="num text-[10.5px] font-medium opacity-80">
                  {best !== undefined ? `${(best * 100).toFixed(1)}¢` : "no offers"}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-3 flex rounded-btn border border-line p-0.5" role="tablist">
        {(["market", "limit"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setStatus("");
            }}
            className={`h-8 flex-1 rounded-[5px] text-[12px] font-medium capitalize transition-colors ${
              mode === m ? "bg-surface2 text-fg" : "text-dim hover:text-muted"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {(["buy", "sell"] as const).map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={action === a}
            onClick={() => {
              setAction(a);
              setStatus("");
            }}
            className={`h-8 rounded-[5px] border text-[12px] font-medium capitalize transition-colors ${
              action === a
                ? "border-line2 bg-surface2 text-fg"
                : "border-line text-dim hover:text-muted"
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      {mode === "limit" ? (
        <>
          <label htmlFor="price" className="mt-3 block text-[11px] font-medium text-dim">
            Price
          </label>
          <div className="mt-1.5 flex w-full items-center gap-2 rounded-btn border border-line bg-black px-3 focus-within:border-line2">
            <input
              id="price"
              inputMode="decimal"
              value={priceCents}
              onChange={(e) => setPriceCents(e.target.value.replace(/[^0-9.]/g, ""))}
              className="num h-11 w-full min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-dim"
              placeholder="50.0"
            />
            <span className="text-[13px] font-medium text-dim">¢</span>
          </div>
          <div className="mt-1.5 flex gap-1.5">
            {bestBid !== undefined ? (
              <button
                type="button"
                onClick={() => setPriceCents((bestBid * 100).toFixed(1))}
                className="h-7 flex-1 rounded-[5px] border border-line text-[11px] text-muted transition-colors hover:border-line2 hover:text-fg"
              >
                bid {(bestBid * 100).toFixed(1)}
              </button>
            ) : null}
            {bestAsk !== undefined ? (
              <button
                type="button"
                onClick={() => setPriceCents((bestAsk * 100).toFixed(1))}
                className="h-7 flex-1 rounded-[5px] border border-line text-[11px] text-muted transition-colors hover:border-line2 hover:text-fg"
              >
                ask {(bestAsk * 100).toFixed(1)}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setPriceCents(((isYes ? midPrice : 1 - midPrice) * 100).toFixed(1))}
              className="h-7 flex-1 rounded-[5px] border border-line text-[11px] text-muted transition-colors hover:border-line2 hover:text-fg"
            >
              mid
            </button>
          </div>
        </>
      ) : null}

      <label htmlFor="amount" className="mt-3 block text-[11px] font-medium text-dim">
        Amount
      </label>
      <div className="mt-1.5 flex w-full items-center gap-2 rounded-btn border border-line bg-black px-3 focus-within:border-line2">
        <input
          id="amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          className="num h-11 w-full min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-dim"
          placeholder="0.00"
        />
        <span className="text-[13px] font-medium text-dim">{unitLabel}</span>
      </div>

      <div className="mt-2 flex gap-1.5">
        {(mode === "market" && action === "buy" ? [10, 25, 50, 100] : [10, 50, 100, 500]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(String(p))}
            className="h-7 flex-1 rounded-[5px] border border-line bg-surface2 text-[11.5px] text-muted transition-colors hover:border-line2 hover:text-fg"
          >
            {p}
          </button>
        ))}
      </div>

      <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-[12.5px]">
        {mode === "market" ? (
          <>
            <div className="flex justify-between">
              <dt className="text-muted">Fills across</dt>
              <dd className="num font-medium">
                {plan?.steps.length ?? 0} order{(plan?.steps.length ?? 0) === 1 ? "" : "s"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Worst price</dt>
              <dd className="num font-medium">
                {plan && plan.steps.length > 0
                  ? `${(Math.max(...plan.steps.map((s) => s.price)) * 100).toFixed(1)}¢`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Shares</dt>
              <dd className="num font-medium">{plan ? plan.shares.toFixed(2) : "0.00"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{action === "buy" ? "Cost" : "Proceeds"}</dt>
              <dd className={`num font-semibold ${isYes ? "text-yes" : "text-no"}`}>
                {plan ? `$${plan.cost.toFixed(2)}` : "$0.00"}
              </dd>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between">
              <dt className="text-muted">Shares</dt>
              <dd className="num font-medium">{value.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{action === "buy" ? "You escrow" : "You receive"}</dt>
              <dd className={`num font-semibold ${isYes ? "text-yes" : "text-no"}`}>
                ${(value * limitPrice).toFixed(2)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Payout if right</dt>
              <dd className="num font-medium">${value.toFixed(2)}</dd>
            </div>
          </>
        )}
      </dl>

      {fill ? <FillBar value={fill.value} label={fill.label} /> : null}

      {restingFills.map((o) => (
        <FillBar
          key={o.id}
          value={o.filled}
          label={
            o.live
              ? `#${o.id} · ${(o.filled * 100).toFixed(0)}% filled`
              : `#${o.id} · no longer resting`
          }
        />
      ))}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !BOOK_CONFIGURED || noLiquidity}
        className={`mt-4 h-11 w-full rounded-btn text-[13px] font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40 ${
          action === "buy" ? "bg-fg text-black hover:opacity-90" : "bg-surface2 text-fg hover:opacity-90"
        }`}
      >
        {busy ? "Working…" : label}
      </button>

      {noLiquidity ? (
        <p className="mt-2 text-[11.5px] leading-relaxed text-amber-400/90">
          No {action === "buy" ? "offers" : "bids"} on {isYes ? "Yes" : "No"} to fill against.
          Switch to <button type="button" onClick={() => setMode("limit")} className="underline">Limit</button>{" "}
          and post your own — market orders need someone on the other side.
        </p>
      ) : null}

      {status ? (
        <p aria-live="polite" className="mt-2 text-center text-[11.5px] leading-relaxed text-muted">
          {status}
        </p>
      ) : null}

      {shortUsdc > 1e-9 || shortShares > 1e-9 ? (
        <p className="mt-2 text-center text-[11px] leading-relaxed text-dim">
          {shortUsdc > 1e-9
            ? `Needs ${shortUsdc.toFixed(2)} more USDC — the panel deposits it for you first.`
            : `Needs ${shortShares.toFixed(2)} more shares — the panel splits USDC into Yes + No first.`}
        </p>
      ) : null}

      {account && signedIn === false ? (
        <p className="mt-2 rounded-[6px] border border-ember/40 bg-ember/10 px-3 py-2 text-[11.5px] leading-relaxed text-ember">
          This wallet is not signed in.{" "}
          <Link href="/register" className="font-medium underline underline-offset-2">
            Create an account
          </Link>{" "}
          to trade.
        </p>
      ) : null}

      {account && bal.usdc > 0 ? (
        <p className="mt-2 text-center text-[11px] text-dim">
          <button
            type="button"
            onClick={withdrawAll}
            disabled={busy}
            className="underline decoration-line2 underline-offset-2 hover:text-fg disabled:opacity-40"
          >
            Withdraw {bal.usdc.toFixed(2)} USDC
          </button>
        </p>
      ) : null}
    </section>
  );
}
