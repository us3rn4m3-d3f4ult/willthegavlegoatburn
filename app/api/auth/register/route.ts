import {
  crossOrigin,
  emailProblem,
  hashPassword,
  normalizeEmail,
  passwordProblem,
  sessionCookie,
} from "@/lib/auth";
import { dbReady, getPool } from "@/lib/db";
import { clientIp, createLimiter, json, readJson } from "@/lib/httpx";
import { createSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allow = createLimiter(10, 60_000);

export async function POST(req: Request) {
  if (crossOrigin(req)) return json({ ok: false, error: "bad_origin" }, 403);
  if (!allow(clientIp(req))) {
    return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": "60" });
  }

  const body = await readJson<{ email?: unknown; password?: unknown }>(req);
  if (!body) return json({ ok: false, error: "invalid_body" }, 400);

  const email = normalizeEmail(String(body.email ?? ""));
  const password = String(body.password ?? "");

  const ep = emailProblem(email);
  if (ep) return json({ ok: false, error: ep }, 400);
  const pp = passwordProblem(password, email);
  if (pp) return json({ ok: false, error: pp }, 400);

  if (!(await dbReady())) return json({ ok: false, error: "accounts_unavailable" }, 503);
  const pool = getPool();
  if (!pool) return json({ ok: false, error: "accounts_unavailable" }, 503);

  const hash = await hashPassword(password);

  let userId: string;
  try {
    const { rows } = await pool.query(
      `insert into users (email, password_hash) values ($1, $2) returning id`,
      [email, hash],
    );
    userId = rows[0].id as string;
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return json({ ok: false, error: "email_taken" }, 409);
    }
    return json({ ok: false, error: "db_error" }, 500);
  }

  const token = await createSession(userId, req);
  if (!token) return json({ ok: false, error: "session_failed" }, 500);

  return json({ ok: true, user: { id: userId, email } }, 200, {
    "Set-Cookie": sessionCookie(token),
  });
}
