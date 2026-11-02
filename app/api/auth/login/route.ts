import { createHash } from "node:crypto";
import { crossOrigin, dummyVerify, normalizeEmail, sessionCookie, verifyPassword } from "@/lib/auth";
import { dbReady, getPool } from "@/lib/db";
import { clientIp, createLimiter, json, readJson } from "@/lib/httpx";
import { allowPersistent } from "@/lib/rateLimit";
import { createSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tighter than registration: this is the credential-stuffing target.
const allow = createLimiter(8, 60_000);

export async function POST(req: Request) {
  if (crossOrigin(req)) return json({ ok: false, error: "bad_origin" }, 403);
  if (!allow(clientIp(req))) {
    return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": "60" });
  }

  const body = await readJson<{ email?: unknown; password?: unknown }>(req);
  if (!body) return json({ ok: false, error: "invalid_body" }, 400);

  const email = normalizeEmail(String(body.email ?? ""));
  const password = String(body.password ?? "");

  if (!email || !password) return json({ ok: false, error: "invalid_credentials" }, 401);

  // Two buckets that survive a restart: one per address, one per IP. The memory
  // limiter above stops a burst; these stop a slow distributed attempt.
  const bucket = createHash("sha256").update(email).digest("hex");
  const [ipOk, emailOk] = await Promise.all([
    allowPersistent(`login:ip:${clientIp(req)}`, 30, 600),
    allowPersistent(`login:email:${bucket}`, 10, 900),
  ]);
  if (!ipOk || !emailOk) {
    return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": "300" });
  }

  if (!(await dbReady())) return json({ ok: false, error: "accounts_unavailable" }, 503);
  const pool = getPool();
  if (!pool) return json({ ok: false, error: "accounts_unavailable" }, 503);

  const { rows } = await pool.query(
    `select id, email, password_hash from users where email = $1`,
    [email],
  );

  if (rows.length === 0) {
    await dummyVerify(); // equalise timing with a real verification
    return json({ ok: false, error: "invalid_credentials" }, 401);
  }

  const ok = await verifyPassword(password, rows[0].password_hash as string);
  if (!ok) return json({ ok: false, error: "invalid_credentials" }, 401);

  const token = await createSession(rows[0].id as string, req);
  if (!token) return json({ ok: false, error: "session_failed" }, 500);

  return json({ ok: true, user: { id: rows[0].id, email: rows[0].email } }, 200, {
    "Set-Cookie": sessionCookie(token),
  });
}
