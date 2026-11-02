import { crossOrigin } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { createLimiter, json, readJson } from "@/lib/httpx";
import { sessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createLimiter(10, 60_000);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accounts younger than this cannot hide anything: throwaway sybils are cheap. */
const MIN_ACCOUNT_AGE_MS = 60 * 60_000;
/** One report flags for review, three from established accounts hide it. */
const HIDE_AT = 3;

/**
 * Flag someone else's comment.
 *
 * Deliberately hard to weaponise: one row per (comment, reporter), only accounts
 * older than an hour count, a single report only marks the comment for review,
 * and hiding needs three. Nothing is deleted, and every hide is logged so it can
 * be undone (`docs/METRICS.md`).
 */
export async function POST(req: Request) {
  if (crossOrigin(req)) return json({ ok: false, error: "bad_origin" }, 403);

  const user = await sessionUser(req);
  if (!user) return json({ ok: false, error: "sign_in_required" }, 401);
  if (!limiter(user.id)) return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": "60" });

  // Too new to weigh in. Same response as a successful report, so the age rule is
  // not a probe either.
  if (Date.now() - new Date(user.createdAt).getTime() < MIN_ACCOUNT_AGE_MS) {
    return json({ ok: true });
  }

  const body = await readJson<{ id?: unknown }>(req);
  const id = String(body?.id ?? "");
  if (!UUID.test(id)) return json({ ok: false, error: "invalid_id" }, 400);

  const pool = getPool();
  if (!pool) return json({ ok: false, error: "accounts_unavailable" }, 503);

  // The SELECT is the authorisation: a comment that does not exist, is already
  // hidden, or is your own inserts nothing, and the response is identical.
  await pool
    .query(
      `insert into comment_reports (comment_id, user_id)
       select c.id, $2 from comments c
        where c.id = $1 and c.user_id <> $2 and c.hidden = false
       on conflict do nothing`,
      [id, user.id],
    )
    .catch(() => {});

  const { rows } = await pool
    .query(
      `select count(*)::int as n
         from comment_reports r
         join users u on u.id = r.user_id
        where r.comment_id = $1 and u.created_at < now() - interval '1 hour'`,
      [id],
    )
    .catch(() => ({ rows: [{ n: 0 }] }));
  const reports = (rows[0]?.n as number) ?? 0;

  if (reports >= 1) {
    await pool
      .query(`update comments set flagged_at = coalesce(flagged_at, now()) where id = $1`, [id])
      .catch(() => {});
  }

  if (reports >= HIDE_AT) {
    await pool.query(`update comments set hidden = true where id = $1`, [id]).catch(() => {});
    console.warn("comment hidden after reports " + JSON.stringify({ id, reports }));
  }

  return json({ ok: true });
}
