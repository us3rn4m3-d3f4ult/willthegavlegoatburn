import { json } from "@/lib/httpx";
import { MAIL_CONFIGURED } from "@/lib/mail";
import { remainingCodes } from "@/lib/recovery";
import { countSessions, sessionUser } from "@/lib/session";
import { linkedWallet } from "@/lib/walletLink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await sessionUser(req);
  if (!user) {
    return json({
      ok: true,
      user: null,
      sessions: 0,
      recoveryRemaining: 0,
      wallet: null,
      emailVerified: false,
      mailConfigured: MAIL_CONFIGURED,
    });
  }

  return json({
    ok: true,
    user,
    sessions: await countSessions(user.id),
    recoveryRemaining: await remainingCodes(user.id),
    wallet: await linkedWallet(user.id),
    emailVerified: Boolean(user.emailVerifiedAt),
    mailConfigured: MAIL_CONFIGURED,
  });
}
