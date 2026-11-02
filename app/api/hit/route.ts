import { crossOrigin } from "@/lib/auth";
import { dbReady, getPool } from "@/lib/db";
import { clientIp, createLimiter, json, readJson } from "@/lib/httpx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createLimiter(30, 60_000);

/** Only real page paths, so the table cannot be filled with arbitrary strings. */
const PATH = /^\/[a-z0-9\-/[\]]{0,80}$/i;

/**
 * One anonymous page view.
 *
 * Deliberately blunt: a day, a path and a counter. No IP address, no user-agent,
 * no cookie and no session id are written, which is why this does not need
 * consent and why /privacy can call the result anonymous.
 */
export async function POST(req: Request) {
  // Same-origin only: a third-party page must not be able to inflate the count.
  if (crossOrigin(req)) return json({ ok: false }, 403);
  if (!limiter(clientIp(req))) return json({ ok: false }, 429);

  const body = await readJson<{ path?: unknown }>(req);
  if (!body) return json({ ok: false }, 400);

  const path = String(body.path ?? "")
    .split("?")[0]
    .split("#")[0]
    .slice(0, 80);

  if (!PATH.test(path)) return json({ ok: false }, 400);
  if (!(await dbReady())) return json({ ok: true }, 202);

  const pool = getPool();
  if (!pool) return json({ ok: true }, 202);

  await pool
    .query(
      `insert into page_views (day, path, hits) values (current_date, $1, 1)
       on conflict (day, path) do update set hits = page_views.hits + 1`,
      [path],
    )
    .catch(() => {});

  return json({ ok: true }, 202);
}
