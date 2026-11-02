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

  return json({ ok: true }, 202);
}
