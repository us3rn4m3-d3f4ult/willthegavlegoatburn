import { json } from "@/lib/httpx";
import { remainingCodes } from "@/lib/recovery";
import { countSessions, sessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await sessionUser(req);
  if (!user) return json({ ok: true, user: null, sessions: 0, recoveryRemaining: 0 });

  return json({
    ok: true,
    user,
    sessions: await countSessions(user.id),
    recoveryRemaining: await remainingCodes(user.id),
  });
}
