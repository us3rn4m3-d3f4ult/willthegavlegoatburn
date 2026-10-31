/**
 * Demo market data.
 *
 * Everything here is replaced by contract reads + indexer queries in
 * lib/contracts.ts once the CLOB is deployed. Kept in one file so the UI can be
 * built and reviewed before the contracts exist.
 */

export type Level = { price: number; size: number };
export type Trade = { side: "YES" | "NO"; price: number; size: number; ago: string };

export const MARKET = {
  question: "Will the Gävle goat burn in 2026?",
  slug: "2026",
  closesAt: "2027-01-01T00:00:00+01:00",
  closesAtLabel: "1 Jan 2027 · 00:00 CET",
  resolutionLabel: "Resolved from the official Visit Gävle live feed + SVT / Aftonbladet",
  bestBid: 0.61,
  bestAsk: 0.62,
  mid: 0.615,
  volume: 30_412,
  liquidity: 11_840,
  traders: 412,
} as const;

export const ASKS: Level[] = [
  { price: 0.66, size: 1240 },
  { price: 0.65, size: 880 },
  { price: 0.64, size: 2150 },
  { price: 0.63, size: 640 },
  { price: 0.62, size: 3100 },
];

export const BIDS: Level[] = [
  { price: 0.61, size: 900 },
  { price: 0.6, size: 1420 },
  { price: 0.59, size: 760 },
  { price: 0.58, size: 2300 },
  { price: 0.57, size: 1100 },
];

export const TRADES: Trade[] = [
  { side: "YES", price: 0.62, size: 240, ago: "12s" },
  { side: "NO", price: 0.38, size: 180, ago: "48s" },
  { side: "YES", price: 0.61, size: 900, ago: "1m" },
  { side: "NO", price: 0.39, size: 75, ago: "3m" },
  { side: "YES", price: 0.6, size: 410, ago: "6m" },
  { side: "YES", price: 0.6, size: 120, ago: "9m" },
  { side: "NO", price: 0.4, size: 620, ago: "14m" },
];

/** 30-day implied-probability series, oldest → newest. */
export const PRICE_HISTORY = [
  0.41, 0.44, 0.43, 0.47, 0.45, 0.49, 0.52, 0.5, 0.53, 0.55, 0.54, 0.57, 0.56,
  0.58, 0.55, 0.59, 0.61, 0.6, 0.62, 0.6, 0.63, 0.61, 0.62, 0.64, 0.63, 0.62,
  0.61, 0.63, 0.62, 0.615,
];

export const GOAT_HISTORY: { year: number; event: string; burned: boolean }[] = [
  { year: 1966, event: "The first goat. Burned on New Year's Eve.", burned: true },
  { year: 1969, event: "Burned on New Year's Eve.", burned: true },
  { year: 1970, event: "Burned six hours after it was erected.", burned: true },
  { year: 1971, event: "Smashed, then burned.", burned: true },
  { year: 1974, event: "Burned.", burned: true },
  { year: 1976, event: "Hit by a truck. Not fire.", burned: false },
  { year: 1985, event: "Burned — 13 m of it.", burned: true },
  { year: 1992, event: "Burned in the small hours.", burned: true },
  { year: 1996, event: "Burned.", burned: true },
  { year: 2001, event: "Burned by a visitor from Cleveland.", burned: true },
  { year: 2005, event: "Burned by unknown arsonists.", burned: true },
  { year: 2016, event: "Burned — the 50th anniversary goat.", burned: true },
  { year: 2021, event: "Hit by a car. Damaged, not burned.", burned: false },
  { year: 2025, event: "Brought down by Storm Johannes on 27 Dec.", burned: false },
];
