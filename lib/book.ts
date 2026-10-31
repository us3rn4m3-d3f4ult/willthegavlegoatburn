import { parseUnits } from "viem";

/**
 * Shared order-book maths. Kept dependency-free so the API route and the client
 * compute the same numbers the contract will: prices in 1e18 scale, shares and
 * USDC in 6 decimals.
 */

export type Level = {
  id: number;
  price: number; // 0..1
  shares: number; // human units
  maker: string;
  isYes: boolean;
};

export type PlanStep = { id: number; price: number; shares: number; cost: number };

export type Plan = {
  steps: PlanStep[];
  shares: number;
  cost: number;
  /** False when the book could not cover the whole request. */
  complete: boolean;
};

const DP = 1_000_000;

/** Truncate to 6dp — the contract's share precision. Never rounds up. */
export function floorShares(n: number): number {
  return Math.floor(n * DP + 1e-9) / DP;
}

/** Walk asks cheapest-first, spending at most `budget` USDC. */
export function planBuy(asks: Level[], budget: number): Plan {
  const steps: PlanStep[] = [];
  let left = budget;
  let shares = 0;

  for (const a of asks) {
    if (left <= 1e-9 || a.price <= 0) break;
    const affordable = left / a.price;
    const take = floorShares(Math.min(a.shares, affordable));
    if (take <= 0) continue;
    const cost = floorShares(take * a.price);
    if (cost > left) continue;
    steps.push({ id: a.id, price: a.price, shares: take, cost });
    left -= cost;
    shares += take;
  }

  const cost = steps.reduce((s, x) => s + x.cost, 0);
  return { steps, shares: floorShares(shares), cost: floorShares(cost), complete: left <= 1e-9 };
}

/** Walk bids highest-first, selling up to `want` shares. */
export function planSell(bids: Level[], want: number): Plan {
  const steps: PlanStep[] = [];
  let left = want;
  let cost = 0;

  for (const b of bids) {
    if (left <= 1e-9) break;
    const take = floorShares(Math.min(b.shares, left));
    if (take <= 0) continue;
    const proceeds = floorShares(take * b.price);
    steps.push({ id: b.id, price: b.price, shares: take, cost: proceeds });
    left -= take;
    cost += proceeds;
  }

  const filledShares = steps.reduce((s, x) => s + x.shares, 0);
  return {
    steps,
    shares: floorShares(filledShares),
    cost: floorShares(cost),
    complete: left <= 1e-9,
  };
}

/** Cents (1.5 = 1.5¢) -> the 1e18 price the contract expects. */
export function centsToWei(cents: number): bigint {
  const clamped = Math.min(100, Math.max(0, cents));
  return parseUnits(clamped.toFixed(2), 16);
}

export function units(amount: number): bigint {
  return parseUnits(Math.max(0, amount).toFixed(6), 6);
}
