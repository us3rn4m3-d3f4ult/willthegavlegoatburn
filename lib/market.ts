/**
 * Static market metadata. Numbers come from the contract and the API routes,
 * never from here.
 */

export const MARKET = {
  question: "Will the Gävle goat burn in 2026?",
  slug: "2026",
  closesAt: "2027-01-01T00:00:00+01:00",
  closesAtLabel: "1 Jan 2027 · 00:00 CET",
  // Neutral fallback only; the live price comes from the order book.
  mid: 0.5,
} as const;

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
