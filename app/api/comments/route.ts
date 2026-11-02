import { createHmac } from "node:crypto";
import { crossOrigin } from "@/lib/auth";
import { dbReady, getPool } from "@/lib/db";
import { normalizeGif, type Gif } from "@/lib/gifs";
import { clientIp, createLimiter, json, readJson } from "@/lib/httpx";
import { VERIFY_REQUIRED } from "@/lib/mail";
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
  gif_url: string | null;
  gif_width: number | null;
  gif_height: number | null;
  gif_alt: string | null;
};

/** The stored GIF columns, in the shape the client renders. */
function gifOf(row: Row): Gif | null {
  if (!row.gif_url) return null;
  return {
    url: row.gif_url,
    width: row.gif_width ?? 200,
    height: row.gif_height ?? 200,
    alt: row.gif_alt ?? "GIF",
  };
}

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

  // Knowing who is asking lets the list mark their own comments, so the UI can
  // offer a delete control without trusting a client-side name comparison.
  const viewer = await sessionUser(req);

  const url = new URL(req.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const perPage = Number.parseInt(url.searchParams.get("perPage") ?? "10", 10) || 10;
  const offset = (page - 1) * perPage;

  const { rows } = await pool
    .query(
      `select c.id, c.body, c.created_at, c.user_id, u.username,
              c.gif_url, c.gif_width, c.gif_height, c.gif_alt,
              coalesce(p.yes_shares, 0)::text as yes_shares,
              coalesce(p.no_shares, 0)::text  as no_shares
         from comments c
         join users u on u.id = c.user_id
         left join positions p on p.user_id = c.user_id
        where c.hidden = false
        order by c.created_at desc
        limit $1 offset $2`,
      [perPage, offset],
    )
    .catch(() => ({ rows: [] as Row[] }));

  const total = await pool
    .query(`select count(*)::int as n from comments where hidden = false`)
    .then((r) => (r.rows[0]?.n as number) ?? 0)
    .catch(() => 0);

  return json({
    ok: true,
    available: true,
    page,
    perPage,
    total,
    pages: Math.max(1, Math.ceil(total / perPage)),
    comments: (rows as Row[]).map((r) => ({
      id: r.id,
      body: r.body,
      at: r.created_at.toISOString(),
      name: r.username ?? handle(r.user_id),
      yes: Number(r.yes_shares),
      no: Number(r.no_shares),
      mine: Boolean(viewer && viewer.id === r.user_id),
      gif: gifOf(r),
    })),
  });
}

export async function POST(req: Request) {
  if (crossOrigin(req)) return json({ ok: false, error: "bad_origin" }, 403);

  const user = await sessionUser(req);
  if (!user) return json({ ok: false, error: "sign_in_required" }, 401);

  // Only once verification is known to work: an unconfirmed address may not post.
  if (VERIFY_REQUIRED && !user.emailVerifiedAt) {
    return json({ ok: false, error: "verify_email" }, 403);
  }

  if (!attemptLimiter(user.id)) {
    return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": "60" });
  }

  const body = await readJson<{ body?: unknown; gif?: unknown }>(req);
  if (!body) return json({ ok: false, error: "invalid_body" }, 400);

  const text = String(body.body ?? "").trim();

  // A GIF is optional. When one is sent it must be a GIPHY CDN rendition — the
  // client's search result is not trusted, `normalizeGif` is the allowlist.
  const wantsGif = body.gif !== undefined && body.gif !== null;
  const gif = wantsGif ? normalizeGif(body.gif) : null;
  if (wantsGif && !gif) return json({ ok: false, error: "bad_gif" }, 400);

  // A GIF on its own is a complete comment; any text that is present is still
  // moderated, so a link or a slur cannot hitch a ride on the image.
  if (!gif || text.length > 0) {
    const verdict = moderate(text);
    if (!verdict.ok && !(gif && verdict.reason === "too_short")) {
      return json({ ok: false, error: verdict.reason }, 400);
    }
  }

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
    `insert into comments (user_id, body, gif_url, gif_width, gif_height, gif_alt)
     values ($1, $2, $3, $4, $5, $6)
     returning id, body, created_at, user_id, gif_url, gif_width, gif_height, gif_alt`,
    [user.id, text, gif?.url ?? null, gif?.width ?? null, gif?.height ?? null, gif?.alt ?? null],
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
        mine: true,
        gif: gifOf(row),
      },
    },
    201,
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Authors may remove their own comments. */
export async function DELETE(req: Request) {
  if (crossOrigin(req)) return json({ ok: false, error: "bad_origin" }, 403);

  const user = await sessionUser(req);
  if (!user) return json({ ok: false, error: "sign_in_required" }, 401);

  if (!attemptLimiter(user.id)) {
    return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": "60" });
  }

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return json({ ok: false, error: "invalid_id" }, 400);

  const pool = getPool();
  if (!pool) return json({ ok: false, error: "accounts_unavailable" }, 503);

  // The user_id predicate is the authorisation check: a row someone else owns
  // deletes nothing, and the response is identical to a missing row so the
  // endpoint cannot be used to probe which ids exist.
  const { rowCount } = await pool
    .query(`delete from comments where id = $1 and user_id = $2`, [id, user.id])
    .catch(() => ({ rowCount: 0 }));

  if (!rowCount) return json({ ok: false, error: "not_found" }, 404);
  return json({ ok: true });
}
