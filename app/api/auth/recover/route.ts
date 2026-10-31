import { crossOrigin, hashPassword, normalizeEmail, passwordProblem } from "@/lib/auth";
import { dbReady, getPool } from "@/lib/db";
import { clientIp, createLimiter, json, readJson } from "@/lib/httpx";
import { consumeCode } from "@/lib/recovery";
import { destroyAllSessions } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Password-equivalent: this is the most attractive endpoint on the site.
const allow = createLimiter(5, 60_000);

export async function POST(req: Request) {
  if (crossOrigin(req)) return json({ ok: false, error: "bad_origin" }, 403);
  if (!allow(clientIp(req))) {
    return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": "60" });
  }

  const body = await readJson<{ email?: unknown; code?: unknown; newPassword?: unknown }>(req);
  if (!body) return json({ ok: false, error: "invalid_body" }, 400);

  const email = normalizeEmail(String(body.email ?? ""));
  const code = String(body.code ?? "");
  const newPassword = String(body.newPassword ?? "");

  if (!email || !code) return json({ ok: false, error: "invalid_code" }, 400);
  const pp = passwordProblem(newPassword, email);
  if (pp) return json({ ok: false, error: pp }, 400);

  if (!(await dbReady())) return json({ ok: false, error: "accounts_unavailable" }, 503);
  const pool = getPool();
  if (!pool) return json({ ok: false, error: "accounts_unavailable" }, 503);

  const { rows } = await pool.query(`select id from users where email = $1`, [email]);

  if (rows.length === 0) {
    // Do the same amount of work as a real attempt, so timing does not reveal
    // whether the address exists.
    await consumeCode("00000000-0000-0000-0000-000000000000", code).catch(() => false);
    return json({ ok: false, error: "invalid_code" }, 400);
  }

  const userId = rows[0].id as string;

  const ok = await consumeCode(userId, code);
  if (!ok) return json({ ok: false, error: "invalid_code" }, 400);

  const hash = await hashPassword(newPassword);
  await pool.query(`update users set password_hash = $1 where id = $2`, [hash, userId]);

  // Anyone holding an old session may be the person who stole the account.
  await destroyAllSessions(userId);

  return json({ ok: true });
}
