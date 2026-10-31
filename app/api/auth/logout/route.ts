import { clearCookie, crossOrigin } from "@/lib/auth";
import { json } from "@/lib/httpx";
import { destroySession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (crossOrigin(req)) return json({ ok: false, error: "bad_origin" }, 403);
  await destroySession(req);
  return json({ ok: true }, 200, { "Set-Cookie": clearCookie() });
}
