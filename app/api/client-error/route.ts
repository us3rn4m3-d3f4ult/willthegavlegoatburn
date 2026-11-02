import { crossOrigin } from "@/lib/auth";
import { dbReady, getPool } from "@/lib/db";
import { clientIp, createLimiter, json, readJson } from "@/lib/httpx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createLimiter(30, 60_000);

const cut = (v: unknown, n: number) => String(v ?? "").slice(0, n);

/**
 * Client-side crashes are invisible to us otherwise: the visitor sees Next's
 * "Application error" page and the only record is in their console. This writes
 * one greppable line into the container log so `docker logs gavle-web` shows what
 * actually threw, on which browser, from which file.
 */
export async function POST(req: Request) {
  // Same-origin only: a third-party page must not be able to flood the log.
  if (crossOrigin(req)) return json({ ok: false }, 403);
  if (!limiter(clientIp(req))) return json({ ok: false }, 429);

  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return json({ ok: false }, 400);

  console.error(
    "client-error " +
      JSON.stringify({
        kind: cut(body.kind, 40),
        message: cut(body.message, 300),
        stack: cut(body.stack, 1200),
        source: cut(body.source, 200),
        line: Number(body.line) || 0,
        col: Number(body.col) || 0,
        digest: cut(body.digest, 60),
        ua: cut(req.headers.get("user-agent"), 180),
        at: new Date().toISOString(),
      }),
  );

  // Also keep it in Postgres, so a crash is reviewable from a phone instead of
  // only by SSH-ing for `docker logs`. No IP and no account id go in here.
  if (await dbReady()) {
    const pool = getPool();
    if (pool) {
      await pool
        .query(`insert into client_errors (kind, message, stack, path) values ($1, $2, $3, $4)`, [
          cut(body.kind, 40),
          cut(body.message, 300),
          cut(body.stack, 1200),
          cut(body.path, 120),
        ])
        .catch(() => {});
      // Keep the table small without a cron job; a rare prune is plenty.
      if (Math.random() < 0.05) {
        await pool
          .query(
            `delete from client_errors where id <= (select coalesce(max(id), 0) - 2000 from client_errors)`,
          )
          .catch(() => {});
      }
    }
  }

  return json({ ok: true }, 202);
}
