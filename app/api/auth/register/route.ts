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
import { MAIL_CONFIGURED, issueToken, sendAlreadyRegistered, sendVerification } from "@/lib/mail";
import { allowPersistent } from "@/lib/rateLimit";
import { issueCodes } from "@/lib/recovery";
import { createSession } from "@/lib/session";
import { checkUsername } from "@/lib/username";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allow = createLimiter(10, 60_000);

export async function POST(req: Request) {
  if (crossOrigin(req)) return json({ ok: false, error: "bad_origin" }, 403);
  if (!allow(clientIp(req))) {
    return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": "60" });
  }
  if (!(await allowPersistent(`register:ip:${clientIp(req)}`, 30, 3600))) {
    return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": "600" });
  }

  const body = await readJson<{ email?: unknown; password?: unknown; username?: unknown }>(req);
  if (!body) return json({ ok: false, error: "invalid_body" }, 400);

  const email = normalizeEmail(String(body.email ?? ""));
  const password = String(body.password ?? "");
  const usernameRaw = String(body.username ?? "");

  const ep = emailProblem(email);
  if (ep) return json({ ok: false, error: ep }, 400);
  const pp = passwordProblem(password, email);
  if (pp) return json({ ok: false, error: pp }, 400);
  const un = checkUsername(usernameRaw);
  if (!un.ok) return json({ ok: false, error: un.reason }, 400);
  const username = un.username;

  if (!(await dbReady())) return json({ ok: false, error: "accounts_unavailable" }, 503);
  const pool = getPool();
  if (!pool) return json({ ok: false, error: "accounts_unavailable" }, 503);

  const hash = await hashPassword(password);

  let userId: string;
  try {
    const { rows } = await pool.query(
      `insert into users (email, password_hash, username) values ($1, $2, $3) returning id`,
      [email, hash, username],
    );
    userId = rows[0].id as string;
  } catch (err) {
    const e = err as { code?: string; constraint?: string };
    if (e.code === "23505") {
      if (e.constraint?.includes("username")) {
        return json({ ok: false, error: "username_taken" }, 409);
      }
      // The address already has an account. Saying so would tell anyone who asks
      // whether a person is registered here, so with mail configured the answer
      // is identical to a success and the owner gets an email instead.
      if (MAIL_CONFIGURED) {
        void sendAlreadyRegistered(email);
        return json({ ok: true, pending: true }, 200);
      }
      return json({ ok: false, error: "email_taken" }, 409);
    }
    return json({ ok: false, error: "db_error" }, 500);
  }

  const token = await createSession(userId, req);
  if (!token) return json({ ok: false, error: "session_failed" }, 500);

  // Recovery codes are the only account-recovery path — there is no reset email.
  // Failure here must not block signup, so the account is still usable.
  const recoveryCodes = await issueCodes(userId).catch(() => [] as string[]);

  // Verification mail is fire-and-forget: a mail outage must not lose a signup.
  if (MAIL_CONFIGURED) {
    const verifyToken = await issueToken(userId, "verify").catch(() => null);
    if (verifyToken) void sendVerification(email, verifyToken);
  }

  return json({ ok: true, user: { id: userId, email, username }, recoveryCodes }, 200, {
    "Set-Cookie": sessionCookie(token),
  });
}
