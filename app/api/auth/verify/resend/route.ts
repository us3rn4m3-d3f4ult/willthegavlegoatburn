import { crossOrigin } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { json } from "@/lib/httpx";
import { MAIL_CONFIGURED, issueToken, sendVerification } from "@/lib/mail";
import { allowPersistent } from "@/lib/rateLimit";
import { sessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Send a fresh verification link. Three per hour, per account. */
export async function POST(req: Request) {
  if (crossOrigin(req)) return json({ ok: false, error: "bad_origin" }, 403);

  const user = await sessionUser(req);
  if (!user) return json({ ok: false, error: "sign_in_required" }, 401);
  if (!MAIL_CONFIGURED) return json({ ok: false, error: "mail_not_configured" }, 400);
  if (user.emailVerifiedAt) return json({ ok: true, already: true });

  if (!(await allowPersistent(`verify:${user.id}`, 3, 3600))) {
    return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": "600" });
  }

  const pool = getPool();
  if (!pool) return json({ ok: false, error: "accounts_unavailable" }, 503);

  const token = await issueToken(user.id, "verify").catch(() => null);
  if (!token) return json({ ok: false, error: "db_error" }, 500);

  const sent = await sendVerification(user.email, token);
  return json({ ok: sent, sent }, sent ? 200 : 502);
}
