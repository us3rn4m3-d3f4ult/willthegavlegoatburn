import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Password hashing and session tokens.
 *
 * scrypt from node:crypto — no native module to compile, no dependency to keep
 * patched, and memory-hard (OWASP-sanctioned alongside Argon2id). Parameters are
 * N=2^15, r=8, p=1, 64-byte output, stored alongside the salt so they can be
 * raised later without invalidating existing hashes.
 */

const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 96 * 1024 * 1024;

export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-gsess" : "gsess";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function scryptAsync(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, { N, r: R, p: P, maxmem: MAXMEM }, (err, key) => {
      if (err) reject(err);
      else resolve(key as Buffer);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEYLEN);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltB64, keyB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");

  const key = await new Promise<Buffer | null>((resolve) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      expected.length,
      { N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM },
      (err, dk) => resolve(err ? null : (dk as Buffer)),
    );
  });

  if (!key || key.length !== expected.length) return false;
  return timingSafeEqual(key, expected);
}

/** Burn time on a nonexistent account so login timing does not leak existence. */
export async function dummyVerify(): Promise<void> {
  await scryptAsync("dummy-password-for-timing", randomBytes(16), KEYLEN).catch(() => {});
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailProblem(email: string): string | null {
  if (email.length < 5 || email.length > 254) return "invalid_email";
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return "invalid_email";
  return null;
}

export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < 10) return "password_too_short";
  if (password.length > 200) return "password_too_long";
  if (email && password.toLowerCase() === email.split("@")[0].toLowerCase()) {
    return "password_too_guessable";
  }
  return null;
}

export function readToken(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function sessionCookie(token: string): string {
  const base = `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`;
  return process.env.NODE_ENV === "production" ? `${base}; Secure` : base;
}

export function clearCookie(): string {
  const base = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  return process.env.NODE_ENV === "production" ? `${base}; Secure` : base;
}

/** Same-origin guard for state-changing requests (defence in depth alongside SameSite). */
export function crossOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false; // same-origin fetch always sends Origin for POST
  try {
    const host = req.headers.get("host");
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}
