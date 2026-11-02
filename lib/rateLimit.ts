import { getPool } from "./db";

/**
 * Cross-process rate limit, backed by Postgres.
 *
 * The limiter in `lib/httpx` lives in memory: a restart forgets it, and a second
 * container would double every allowance. That is fine for reads, but the
 * credential endpoints are the ones worth counting properly, so they also count
 * here. The memory limiter stays in front as a cheap first stop.
 *
 * Fails open when the database is down — which is also when login cannot work
 * anyway, so there is nothing to protect.
 */
export async function allowPersistent(
  bucket: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const pool = getPool();
  if (!pool) return true;

  const result = await pool
    .query(
      `insert into rate_limits (bucket, window_start, n) values ($1, now(), 1)
       on conflict (bucket) do update set
         n = case
               when rate_limits.window_start < now() - make_interval(secs => $2) then 1
               else rate_limits.n + 1
             end,
         window_start = case
               when rate_limits.window_start < now() - make_interval(secs => $2) then now()
               else rate_limits.window_start
             end
       returning n`,
      [bucket, windowSeconds],
    )
    .catch(() => null);

  if (!result || result.rows.length === 0) return true;

  // Cheap housekeeping: past a day the row can never match a window again.
  if (Math.random() < 0.02) {
    pool.query(`delete from rate_limits where window_start < now() - interval '1 day'`).catch(() => {});
  }

  return (result.rows[0].n as number) <= max;
}
