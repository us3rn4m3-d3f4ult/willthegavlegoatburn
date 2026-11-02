import { dbReady } from "@/lib/db";
import { BOOK_CONFIGURED, publicClient } from "@/lib/web3";
import { json } from "@/lib/httpx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Uptime endpoint for an external monitor (UptimeRobot, BetterStack, a cron with
 * curl). `ok` is false when the database or the RPC is unreachable — the two
 * things that quietly break the site while the HTML still serves.
 */
export async function GET() {
  const db = await dbReady();

  let rpc = false;
  if (BOOK_CONFIGURED) {
    try {
      await publicClient.getBlockNumber();
      rpc = true;
    } catch {
      rpc = false;
    }
  }

  const ok = db && (rpc || !BOOK_CONFIGURED);
  return json({ ok, db, rpc, at: new Date().toISOString() }, ok ? 200 : 503);
}
