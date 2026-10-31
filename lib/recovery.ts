import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { getPool } from "./db";

/**
 * One-time recovery codes.
 *
 * 16 characters from a 32-symbol alphabet = 80 bits of entropy, formatted as
 * four groups. Stored as an HMAC-SHA256 over a server-side pepper, so a stolen
 * database alone cannot be used to reset an account: the pepper lives in the
 * environment, not in the dump.
 *
 * No slow KDF is needed because the input is already high-entropy randomness —
 * unlike a password, there is nothing to guess cheaply.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
const GROUPS = 4;
const GROUP_LEN = 4;
export const CODE_COUNT = 10;

function pepper(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET must be set (16+ chars) before issuing recovery codes");
  }
  return secret;
}

export function generateCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let group = "";
    for (let i = 0; i < GROUP_LEN; i++) {
      group += ALPHABET[randomInt(ALPHABET.length)];
    }
    groups.push(group);
  }
  return groups.join("-");
}

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashCode(code: string): string {
  return createHmac("sha256", pepper()).update(normalizeCode(code)).digest("hex");
}

/** Replaces any existing set. Returns the plaintext codes — shown once, never again. */
export async function issueCodes(userId: string, count = CODE_COUNT): Promise<string[]> {
  const pool = getPool();
  if (!pool) throw new Error("no database");

  const codes = Array.from({ length: count }, () => generateCode());
  const hashes = codes.map(hashCode);

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`delete from recovery_codes where user_id = $1`, [userId]);
    for (const hash of hashes) {
      await client.query(
        `insert into recovery_codes (user_id, code_hash) values ($1, $2)`,
        [userId, hash],
      );
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  return codes;
}

export async function remainingCodes(userId: string): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;
  const { rows } = await pool
    .query(
      `select count(*)::int as n from recovery_codes where user_id = $1 and used_at is null`,
      [userId],
    )
    .catch(() => ({ rows: [{ n: 0 }] }));
  return (rows[0]?.n as number) ?? 0;
}

/**
 * Single-use: marks the matching code consumed. Returns false for an unknown or
 * already-used code, so a wrong code leaks nothing about the others.
 */
export async function consumeCode(userId: string, code: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;

  const normalized = normalizeCode(code);
  if (normalized.length !== GROUPS * GROUP_LEN) return false;

  const { rows } = await pool.query(
    `select id, code_hash from recovery_codes where user_id = $1 and used_at is null`,
    [userId],
  );

  const target = Buffer.from(hashCode(code), "hex");
  let matchedId: string | null = null;

  for (const row of rows) {
    const candidate = Buffer.from(row.code_hash as string, "hex");
    if (candidate.length === target.length && timingSafeEqual(candidate, target)) {
      matchedId = row.id as string;
      break;
    }
  }

  if (!matchedId) return false;

  const update = await pool.query(
    `update recovery_codes set used_at = now() where id = $1 and used_at is null`,
    [matchedId],
  );
  return (update.rowCount ?? 0) === 1;
}
