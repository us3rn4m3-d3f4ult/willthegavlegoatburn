import { createHmac } from "node:crypto";
import { crossOrigin } from "@/lib/auth";
import { dbReady, getPool } from "@/lib/db";
import { clientIp, createLimiter, json, readJson } from "@/lib/httpx";
import { moderate } from "@/lib/moderation";
import { sessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const attemptLimiter = createLimiter(20, 10 * 60_000);
const readLimiter = createLimiter(120, 60_000);

/** Successful posts allowed per user per window. */
const POSTS_PER_WINDOW = 3;
const WINDOW = "10 minutes";

const LIMIT = 50;

type Row = {
  id: string;
  body: string;
  created_at: Date;
  user_id: string;
  username: string | null;
  yes_shares: string;
  no_shares: string;
};

type Cursor = { next: string | null };

/** Stable, non-reversible display handle. Emails are never exposed. */
function handle(userId: string): string {
  const pepper = process.env.SESSION_SECRET;
  // Fail closed: never fall back to a constant an attacker could guess, which
  // would make handles reversible for any user id.
  if (!pepper || pepper.length < 16) return "anon-unavailable";
  return `anon-${createHmac("sha256", pepper).update(userId).digest("hex").slice(0, 6)}`;
}

export async function GET(req: Request) {
  if (!readLimiter(clientIp(req))) {
    return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": "60" });
  }
  if (!(await dbReady())) return json({ ok: true, comments: [], available: false });

  const pool = getPool();
  if (!pool) return json({ ok: true, comments: [], available: false });

  const { rows } = await pool
    .query(
      `select c.id, c.body, c.created_at, c.user_id, u.username,
              coalesce(p.yes_shares, 0)::text as yes_shares,
              coalesce(p.no_shares, 0)::text  as no_shares
         from comments c
         join users u on u.id = c.user_id
         left join positions p on p.user_id = c.user_id
        where c.hidden = false
        order by c.created_at desc
        limit $1`,
      [LIMIT],
    )
    .catch(() => ({ rows: [] as Row[] }));

  return json({
    ok: true,
    available: true,
    comments: (rows as Row[]).map((r) => ({
      id: r.id,
      body: r.body,
      at: r.created_at.toISOString(),
      name: r.username ?? handle(r.user_id),
      yes: Number(r.yes_shares),
      no: Number(r.no_shares),
    })),
  });
}

export async function POST(req: Request) {
  if (crossOrigin(req)) return json({ ok: false, error: "bad_origin" }, 403);

  const user = await sessionUser(req);
  if (!user) return json({ ok: false, error: "sign_in_required" }, 401);

  if (!attemptLimiter(user.id)) {
    return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": "60" });
  }

  const body = await readJson<{ body?: unknown }>(req);
  if (!body) return json({ ok: false, error: "invalid_body" }, 400);

  const text = String(body.body ?? "");
  const verdict = moderate(text);
  if (!verdict.ok) return json({ ok: false, error: verdict.reason }, 400);

  const pool = getPool();
  if (!pool) return json({ ok: false, error: "accounts_unavailable" }, 503);

  // Only accepted posts count against the cap: a rejected attempt (too long,
  // bad language) must never lock someone out for ten minutes.
  const { rows: recent } = await pool.query(
    `select count(*)::int as n from comments
      where user_id = $1 and created_at > now() - interval '${WINDOW}'`,
    [user.id],
  );
  if (((recent[0]?.n as number) ?? 0) >= POSTS_PER_WINDOW) {
    return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": "120" });
  }

  const { rows } = await pool.query(
    `insert into comments (user_id, body) values ($1, $2)
     returning id, body, created_at, user_id`,
    [user.id, text.trim()],
  );

  const row = rows[0] as Row;
  return json(
    {
      ok: true,
      comment: {
        id: row.id,
        body: row.body,
        at: row.created_at.toISOString(),
        name: user.username ?? handle(user.id),
        yes: 0,
        no: 0,
      },
    },
    201,
  );
}
