import { moderate } from "./moderation";

/**
 * Public usernames.
 *
 * Shown next to every comment, so they are moderated with the same word list as
 * comment bodies. Reserved words prevent impersonation of staff or the project.
 */

const PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

const RESERVED = [
  "admin", "administrator", "mod", "moderator", "support", "staff", "official",
  "root", "system", "team", "help", "security", "willthegavlegoatburn", "gavle",
  "gavlebocken", "gavlegoat", "goat", "trading", "market", "operator",
];

export type UsernameCheck = { ok: true; username: string } | { ok: false; reason: string };

export function checkUsername(raw: string): UsernameCheck {
  const username = raw.trim();

  if (!PATTERN.test(username)) return { ok: false, reason: "username_invalid" };

  const lower = username.toLowerCase();
  if (RESERVED.some((r) => lower === r || lower.startsWith(`${r}_`) || lower.startsWith(r + "0"))) {
    return { ok: false, reason: "username_reserved" };
  }
  if (/(.)\1{3,}/.test(username)) return { ok: false, reason: "username_invalid" };

  // Reuses the comment filter, which normalises leetspeak and repeated letters.
  if (!moderate(username).ok) return { ok: false, reason: "username_language" };

  return { ok: true, username };
}
