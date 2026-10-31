"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/useSession";
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
type Balances = { usdc: number; freeYes: number; freeNo: number; wallet: number };

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

/** Turn contract custom errors into something a person can act on. */
function explain(e: unknown): string {
  const m =
    (e as { shortMessage?: string }).shortMessage ??
    (e as { message?: string }).message ??
    "";
  if (/BadOrder/.test(m)) return "The contract rejected those order details (size, price or expiry).";
  if (/InsufficientUsdc/.test(m)) return "Not enough USDC credited in the market for that size.";
  if (/InsufficientShares/.test(m)) return "You do not hold enough free shares to sell that many.";
  if (/NotTrading/.test(m)) return "Trading is closed.";
  if (/TooManyOrders/.test(m)) return "Too many open orders from this wallet (the contract allows 32).";
  if (/SelfTrade/.test(m)) return "You cannot fill your own order.";
  if (/TransferFailed|ERC20/.test(m)) return "The USDC transfer failed — check balance and allowance.";
  if (/TIMEOUT/.test(m)) return "No confirmation after two minutes. Check the transaction on Basescan.";
  if (/user rejected|denied/i.test(m)) return "You rejected the transaction in your wallet.";
  return m || "Transaction failed.";
}

export function TradePanel({
  mid: fallbackMid = 0.5,
  anchor = true,
}: {
  mid?: number;
  anchor?: boolean;
}) {
  const { account, connect, ensureChain, walletClient, connectError } = useWallet();
  const router = useRouter();
  const { pick, bump, version, sideRequest } = useTradeState();

  const [isYes, setIsYes] = useState(true);
  const [action, setAction] = useState<Action>("buy");
  const [mode, setMode] = useState<Mode>("market");
  const [amount, setAmount] = useState("25");
  const [priceCents, setPriceCents] = useState("50.0");
  const [book, setBook] = useState<Book | null>(null);
  const [bal, setBal] = useState<Balances>({ usdc: 0, freeYes: 0, freeNo: 0, wallet: 0 });
  const [expiresAt, setExpiresAt] = useState<bigint | null>(null);
  const [tracked, setTracked] = useState<Tracked[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [ok, setOk] = useState<string | null>(null);
  const [fill, setFill] = useState<{ value: number; label: string } | null>(null);
  const signedIn = useSession();

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

  const loadBalances = useCallback(async (): Promise<Balances | null> => {
    if (!account || !BOOK_CONFIGURED) return null;
    try {
      const [usdc, fy, fn, wallet] = await Promise.all([
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
        publicClient.readContract({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [account],
        }),
      ]);
      const next: Balances = {
        usdc: Number(usdc as bigint) / 1e6,
        freeYes: Number(fy as bigint) / 1e6,
        freeNo: Number(fn as bigint) / 1e6,
        wallet: Number(wallet as bigint) / 1e6,
      };
      setBal(next);
      return next;
    } catch {
      return null;
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

  /** Wait for a receipt, but not forever: a wallet popup left open used to keep the
   *  panel on "Working…" indefinitely with no way out. */
  async function wait(hash: `0x${string}`) {
    setStatus(`Submitted ${hash.slice(0, 10)}… waiting for confirmation.`);
    await Promise.race([
      publicClient.waitForTransactionReceipt({ hash }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), 120_000),
      ),
    ]);
  }

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
      // An approve can be mined a moment before the node we simulate against sees
      // the new allowance, which made the deposit fail right after a good approve.
      for (let i = 0; i < 15; i++) {
        const now = (await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [account, BOOK_ADDRESS],
        })) as bigint;
        if (now >= amt) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    setStatus(`Deposit ${need.toFixed(2)} USDC into the market…`);
    // Simulate first: a deposit that would revert should never reach the wallet.
    const sim = await publicClient.simulateContract({
      address: BOOK_ADDRESS,
      abi: BOOK_ABI,
      functionName: "deposit",
      args: [amt],
      account,
    });
    const h2 = await w.writeContract(sim.request);
    await wait(h2);
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

    const fresh = await loadBalances();
    if (action === "buy") {
      const short = Math.max(0, usdcNeeded - (fresh?.usdc ?? 0));
      if (short > 0) {
        setFill({ value: 0, label: "funding" });
        if (!(await fundUsdc(short))) return;
      }
    } else {
      const held = isYes ? (fresh?.freeYes ?? 0) : (fresh?.freeNo ?? 0);
      const short = Math.max(0, value - held);
      if (short > 0) {
        setFill({ value: 0, label: "getting shares" });
        if (!(await mintShares(short))) return;
      }
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
    if (!expiresAt) {
      setStatus("Still loading the market's closing time — try again in a moment.");
      return;
    }
    // The contract rejects price 0 and price above 100¢; catch it before the
    // deposit moves any money, because the deposit happens first.
    if (!(limitPrice > 0) || limitPrice > 1) {
      setStatus("Enter a price between 0.1¢ and 100¢.");
      return;
    }
    if (!w || !account) return;

    // One click, but never blindly: fund first (approve → wait for the allowance to
    // be visible → deposit → wait for the credit to be visible), then place.
    const fresh = await loadBalances();
    if (action === "buy") {
      const short = usdcNeeded - (fresh?.usdc ?? 0);
      if (short > 1e-9) {
        if (fresh && fresh.wallet + 1e-9 < short) {
          setStatus(
            `That order needs $${usdcNeeded.toFixed(2)}. Your wallet holds $${fresh.wallet.toFixed(2)} USDC.`,
          );
          return;
        }
        if (!(await fundUsdc(short))) return;
      }
    }
    if (action === "sell") {
      const held = isYes ? (fresh?.freeYes ?? 0) : (fresh?.freeNo ?? 0);
      const short = Math.max(0, value - held);
      if (short > 0) {
        if (!(await mintShares(short))) return;
      }
    }

    setStatus(`Placing ${action === "buy" ? "bid" : "ask"} at ${Number(priceCents).toFixed(1)}¢…`);
    // The deposit is mined, but the node we simulate against may not have it yet,
    // which surfaces as a false InsufficientUsdc. Wait for the credit to be
    // visible, then simulate. Retries only that specific revert.
    const wantCredit = units(usdcNeeded);
    if (action === "buy" && account) {
      for (let i = 0; i < 15; i++) {
        const credit = (await publicClient.readContract({
          address: BOOK_ADDRESS,
          abi: BOOK_ABI,
          functionName: "usdcBalance",
          args: [account],
        })) as bigint;
        if (credit >= wantCredit) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    let sim;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        sim = await publicClient.simulateContract({
          address: BOOK_ADDRESS,
          abi: BOOK_ABI,
          functionName: action === "buy" ? "placeBid" : "placeAsk",
          args: [isYes, units(value), centsToWei(Number(priceCents)), expiresAt],
          account,
        });
        break;
      } catch (err) {
        const msg = (err as { message?: string }).message ?? "";
        if (attempt === 4 || !/febd90e7|InsufficientUsdc/i.test(msg)) throw err;
        setStatus("Waiting for the deposit to register…");
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    if (!sim) throw new Error("InsufficientUsdc");
    const h = await w.writeContract(sim.request);
    await wait(h);

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
    const placed = `${action === "buy" ? "Bid" : "Ask"} placed: ${value.toFixed(2)} ${
      isYes ? "Yes" : "No"
    } at ${Number(priceCents).toFixed(1)}¢, resting in the book.`;
    setStatus(placed);
    setOk(placed);
    // Refresh the book now, and again shortly after in case the node was still
    // catching up when the first read went out.
    bump();
    setTimeout(bump, 1500);
    setTimeout(bump, 4000);
    void loadBalances();
    setTimeout(() => setOk(null), 6000);
  }

  async function submit() {
    if (signedIn !== true) {
      router.push("/register");
      return;
    }
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
    setOk(null);
    setFill(null);
    try {
      if (mode === "market") await runMarket();
      else await placeLimit();
    } catch (err) {
      setStatus(explain(err));
    } finally {
      setBusy(false);
      // Always re-read after a failure: the deposit may have gone through even when
      // the order did not, and the panel has to say so.
      void loadBalances();
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
  const needsDeposit =
    mode === "limit" && action === "buy" && usdcNeeded > bal.usdc + 1e-9 && usdcNeeded > 0;

  const label = !BOOK_CONFIGURED
    ? "Market not deployed"
    : ok
      ? "Order placed ✓"
      : signedIn !== true
      ? "Register to trade"
      : !account
        ? "Connect wallet to trade"
        : busy
          ? "Working…"
          : needsDeposit
            ? `Buy ${isYes ? "Yes" : "No"} · $${usdcNeeded.toFixed(2)}`
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
            {bestAsk !== undefined ? (
              <button
                type="button"
                onClick={() => setPriceCents((bestAsk * 100).toFixed(1))}
                className="h-7 flex-1 rounded-[5px] border border-line text-[11px] text-muted transition-colors hover:border-line2 hover:text-fg"
              >
                ask {(bestAsk * 100).toFixed(1)}
              </button>
            ) : null}
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
        disabled={busy || ok !== null || !BOOK_CONFIGURED || (signedIn === true && Boolean(account) && noLiquidity)}
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

      <details className="mt-3 rounded-[6px] border border-line bg-black px-3 py-2">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] text-muted [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden="true"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-line2 text-[9px] font-semibold leading-none text-muted"
          >
            i
          </span>
          Which coin and network to use
        </summary>
        <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-dim">
          <p>
            Only <span className="font-medium text-fg">USDC on Base</span> (chain id 8453,
            contract <span className="num">0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913</span>)
            works here.
          </p>
          <p>
            USDC on Ethereum, Polygon, Arbitrum or anywhere else will not appear in your
            balance, and nobody can recover it for you. Same for ETH or other tokens sent to
            this contract.
          </p>
          <p>
            Keep a little <span className="font-medium text-fg">ETH on Base</span> in the
            wallet for gas. Transactions cost a fraction of a cent, but they are not free.
          </p>
        </div>
      </details>

      {status || connectError ? (
        <p
          aria-live="polite"
          className={`mt-2 text-center text-[11.5px] leading-relaxed ${
            ok ? "font-medium text-yes" : "text-muted"
          }`}
        >
          {ok ?? status ?? connectError}
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
