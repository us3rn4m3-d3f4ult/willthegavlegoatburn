import {
  clearCookie,
  crossOrigin,
  hashPassword,
  passwordProblem,
  sessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { getPool } from "@/lib/db";
import { clientIp, createLimiter, json, readJson } from "@/lib/httpx";
import { createSession, destroyAllSessions, sessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allow = createLimiter(6, 60_000);

type Body = {
  action?: unknown;
  currentPassword?: unknown;
  newPassword?: unknown;
  confirm?: unknown;
};

export async function POST(req: Request) {
  if (crossOrigin(req)) return json({ ok: false, error: "bad_origin" }, 403);
  if (!allow(clientIp(req))) {
    return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": "60" });
  }

  const user = await sessionUser(req);
  if (!user) return json({ ok: false, error: "not_signed_in" }, 401);

  const pool = getPool();
  if (!pool) return json({ ok: false, error: "accounts_unavailable" }, 503);

  const body = await readJson<Body>(req);
  if (!body) return json({ ok: false, error: "invalid_body" }, 400);

  const action = String(body.action ?? "");
  const currentPassword = String(body.currentPassword ?? "");

  if (!currentPassword) return json({ ok: false, error: "password_required" }, 400);

  const { rows } = await pool.query(`select password_hash from users where id = $1`, [user.id]);
  if (rows.length === 0) return json({ ok: false, error: "not_signed_in" }, 401);

  const ok = await verifyPassword(currentPassword, rows[0].password_hash as string);
  if (!ok) return json({ ok: false, error: "wrong_password" }, 401);

  // ── change password ──────────────────────────────────────────────────────
  if (action === "password") {
    const newPassword = String(body.newPassword ?? "");
    const pp = passwordProblem(newPassword, user.email);
    if (pp) return json({ ok: false, error: pp }, 400);
    if (newPassword === currentPassword) {
      return json({ ok: false, error: "same_password" }, 400);
    }

    const hash = await hashPassword(newPassword);
    await pool.query(`update users set password_hash = $1 where id = $2`, [hash, user.id]);

    // Every other session is now suspect — drop them all and re-issue ours.
    await destroyAllSessions(user.id);
    const token = await createSession(user.id, req);
    if (!token) return json({ ok: false, error: "session_failed" }, 500);

    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(token) });
  }

  // ── delete account ───────────────────────────────────────────────────────
  if (action === "delete") {
    if (String(body.confirm ?? "") !== "DELETE") {
      return json({ ok: false, error: "confirm_required" }, 400);
    }
    // sessions cascade; the row is gone for good — there is no soft delete and
    // no way to recover an email that was used here.
    await pool.query(`delete from users where id = $1`, [user.id]);
    return json({ ok: true }, 200, { "Set-Cookie": clearCookie() });
  }

  return json({ ok: false, error: "unknown_action" }, 400);
}
