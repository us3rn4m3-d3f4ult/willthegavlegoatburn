import { dbReady, getPool } from "@/lib/db";

/**
 * The wallet an account has proved it owns. Public information only — the key
 * never leaves the device, which is what keeps this non-custodial.
 */
export async function linkedWallet(userId: string): Promise<string | null> {
  if (!(await dbReady())) return null;
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool
    .query(`select wallet_address from users where id = $1`, [userId])
    .catch(() => ({ rows: [] as { wallet_address: string | null }[] }));
  return (rows[0]?.wallet_address as string | null) ?? null;
}

/** True when another account already claimed this address. */
export async function addressTaken(address: string, exceptUserId: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  const { rows } = await pool
    .query(
      `select 1 from users where lower(wallet_address) = lower($1) and id <> $2 limit 1`,
      [address, exceptUserId],
    )
    .catch(() => ({ rows: [] }));
  return rows.length > 0;
}

export async function setLinkedWallet(userId: string, address: string | null): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool
    .query(`update users set wallet_address = $1 where id = $2`, [address, userId])
    .catch(() => {});
}

/** The exact text the wallet signs. Client and server must build it identically. */
export function linkMessage(userId: string, address: string, issued: string): string {
  return [
    "willthegavlegoatburn.com",
    "Link this wallet to my account.",
    "",
    `Account: ${userId}`,
    `Address: ${address}`,
    `Issued: ${issued}`,
  ].join("\n");
}
