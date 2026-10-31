/**
 * Basic comment moderation.
 *
 * This is a speed bump, not a solution: a determined person can evade a word
 * list. It exists so the page is not wide open to slurs and spam on day one.
 * Replace it with a maintained service (or human review) once there is traffic.
 *
 * Deliberate limits: no links, no markup, maximum 500 characters, signed-in
 * users only.
 */

const MAX_LENGTH = 500;
const MIN_LENGTH = 2;

/**
 * Starter blocklist. Leetspeak and repeated letters are normalised before
 * matching, because "sh1t" and "shiiit" are the same intent.
 */
const BLOCKED = [
  "fuck", "shit", "bitch", "cunt", "asshole", "bastard", "dickhead", "wanker",
  "twat", "prick", "slut", "whore", "retard", "spastic", "nonce", "rape",
  "nigger", "nigga", "faggot", "kike", "spic", "chink", "tranny", "wetback",
  "kill yourself", "kys", "gas the",
];

const LEET: [RegExp, string][] = [
  [/[0@]/g, "o"],
  [/[1!|]/g, "i"],
  [/3/g, "e"],
  [/4/g, "a"],
  [/[5$]/g, "s"],
  [/7/g, "t"],
  [/8/g, "b"],
];

function normalize(input: string): string {
  let s = input.toLowerCase();
  for (const [pattern, replacement] of LEET) s = s.replace(pattern, replacement);
  return s.replace(/[^a-z\s]/g, " ");
}

/** Collapse every run of 3+ identical letters down to one: "shiiit" -> "shit". */
function collapse(input: string): string {
  return input.replace(/([a-z])\1{2,}/g, "$1");
}

export type ModerationResult = { ok: true } | { ok: false; reason: string };

export function moderate(body: string): ModerationResult {
  const trimmed = body.trim();

  if (trimmed.length < MIN_LENGTH) return { ok: false, reason: "too_short" };
  if (trimmed.length > MAX_LENGTH) return { ok: false, reason: "too_long" };

  // Links are the main spam vector and there is nothing to legitimately link to here.
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|xyz|ru|co)\b/i.test(trimmed)) {
    return { ok: false, reason: "no_links" };
  }

  const normalised = normalize(trimmed);
  const tightened = collapse(normalised);

  for (const word of BLOCKED) {
    if (normalised.includes(word) || tightened.includes(word)) {
      return { ok: false, reason: "language" };
    }
  }

  // Caps lock shouting and repeated-character spam.
  const letters = trimmed.replace(/[^a-zA-Z]/g, "");
  if (letters.length > 12 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.8) {
    return { ok: false, reason: "shouting" };
  }
  if (/(.)\1{9,}/.test(trimmed)) return { ok: false, reason: "spam" };

  return { ok: true };
}
