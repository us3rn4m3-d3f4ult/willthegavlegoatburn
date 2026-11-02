import { createHash, randomBytes } from "node:crypto";
import { getPool } from "./db";

/**
 * Outbound email, used only for address verification.
 *
 * Configured with a Resend key (`RESEND_API_KEY`) and a sender (`MAIL_FROM`).
 * Until a key exists `MAIL_CONFIGURED` is false and:
 *
 *  - registration still works, accounts are simply unverified,
 *  - nothing is gated on verification (comments stay open),
 *  - the account page does not offer a "verify" button it cannot honour.
 *
 * That keeps the product working without a mail provider, and flips the whole
 * flow on the moment a key is added.
 */

const KEY = process.env.RESEND_API_KEY ?? "";
const FROM = process.env.MAIL_FROM ?? "willthegavlegoatburn <noreply@willthegavlegoatburn.com>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://willthegavlegoatburn.com";

export const MAIL_CONFIGURED = KEY.length > 0;

/**
 * Whether an unconfirmed address may post a comment. Deliberately a *separate*
 * switch from MAIL_CONFIGURED: a key can be present while the sending domain is
 * still pending at Resend, and gating on the key alone would lock everyone out
 * of the discussion with no way to confirm.
 *
 * Flip to `1` once a test email actually arrives.
 */
export const VERIFY_REQUIRED = process.env.REQUIRE_VERIFIED_EMAIL === "1";

async function send(to: string, subject: string, text: string): Promise<boolean> {
  if (!MAIL_CONFIGURED) {
    // Never log the body: it can contain a live token.
    console.warn("mail not configured " + JSON.stringify({ to: mask(to), subject }));
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, text }),
    });
    if (!res.ok) console.error("mail send failed " + JSON.stringify({ status: res.status }));
    return res.ok;
  } catch {
    return false;
  }
}

function mask(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return "***";
  return `${name.slice(0, 2)}***@${domain}`;
}

const HOUR = 60 * 60_000;

/**
 * Creates a single-use token for `purpose`, returns the raw value (only its
 * SHA-256 is stored) and the expiry. Any older token of the same purpose is
 * replaced, so only the newest link works.
 */
export async function issueToken(
  userId: string,
  purpose: "verify",
  ttlMs = 24 * HOUR,
): Promise<string | null> {
  const pool = getPool();
  if (!pool) return null;

  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");

  await pool.query(`delete from email_tokens where user_id = $1 and purpose = $2`, [userId, purpose]);
  await pool
    .query(
      `insert into email_tokens (token_hash, user_id, purpose, expires_at)
       values ($1, $2, $3, now() + make_interval(secs => $4))`,
      [hash, userId, purpose, Math.floor(ttlMs / 1000)],
    )
    .catch(() => null);

  return token;
}

/** Consumes a token and returns its user id, or null when unknown/expired. */
export async function consumeToken(token: string, purpose: "verify"): Promise<string | null> {
  const pool = getPool();
  if (!pool) return null;
  if (!token || token.length > 200) return null;

  const hash = createHash("sha256").update(token).digest("hex");
  const { rows } = await pool
    .query(
      `delete from email_tokens
        where token_hash = $1 and purpose = $2 and expires_at > now()
        returning user_id`,
      [hash, purpose],
    )
    .catch(() => ({ rows: [] }));

  return (rows[0]?.user_id as string) ?? null;
}

/** Sends the verification link. Returns false when mail is not configured. */
export async function sendVerification(to: string, token: string): Promise<boolean> {
  const link = `${SITE}/api/auth/verify?token=${encodeURIComponent(token)}`;
  return send(
    to,
    "Confirm your email — willthegavlegoatburn",
    [
      "Confirm this address to finish setting up your account:",
      "",
      link,
      "",
      "The link works once and expires in 24 hours.",
      "If you did not create an account, ignore this message.",
    ].join("\n"),
  );
}

/**
 * Tells an existing account that someone tried to register with its address.
 * Used instead of a "that email is taken" response, which leaks who has an
 * account here.
 */
export async function sendAlreadyRegistered(to: string): Promise<boolean> {
  return send(
    to,
    "Someone tried to sign up with your email",
    [
      "An account with this address already exists on willthegavlegoatburn.com.",
      "",
      "If that was you, sign in instead (or use a recovery code if you have forgotten the password).",
      "If it was not you, nothing has changed and you can ignore this message.",
    ].join("\n"),
  );
}
