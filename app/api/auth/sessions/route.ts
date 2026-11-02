import { crossOrigin } from "@/lib/auth";
import { json } from "@/lib/httpx";
import {
  currentSid,
  listSessions,
  revokeOtherSessions,
  revokeSession,
  sessionUser,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every device signed in to this account, newest activity first. */
export async function GET(req: Request) {
  const user = await sessionUser(req);
  if (!user) return json({ ok: true, sessions: [] });
  return json({ ok: true, sessions: await listSessions(user.id, await currentSid(req)) });
}

/** Revoke one session, or every session except this one. */
export async function DELETE(req: Request) {
  if (crossOrigin(req)) return json({ ok: false, error: "bad_origin" }, 403);

  const user = await sessionUser(req);
  if (!user) return json({ ok: false, error: "sign_in_required" }, 401);

  const url = new URL(req.url);
  const current = await currentSid(req);

  if (url.searchParams.get("others") === "1") {
    await revokeOtherSessions(user.id, current);
    return json({ ok: true });
  }

  const sid = url.searchParams.get("sid") ?? "";
  if (!SID.test(sid)) return json({ ok: false, error: "bad_sid" }, 400);

  // The user_id predicate is the authorisation: a sid belonging to someone else
  // deletes nothing.
  await revokeSession(user.id, sid);
  return json({ ok: true });
}
