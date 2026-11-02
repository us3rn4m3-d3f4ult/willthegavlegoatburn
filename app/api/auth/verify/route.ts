import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { consumeToken } from "@/lib/mail";
import { SITE } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The link in the verification email. A single-use token, then a redirect back to
 * the account page. A GET with a side effect is fine here: the token is random,
 * single-use, expires in 24 hours, and "verifying" is not a destructive action.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const userId = await consumeToken(token, "verify");

  const pool = getPool();
  if (userId && pool) {
    await pool
      .query(
        `update users set email_verified_at = coalesce(email_verified_at, now()) where id = $1`,
        [userId],
      )
      .catch(() => {});
  }

  const back = new URL("/account", SITE.url);
  back.searchParams.set("verified", userId ? "1" : "0");
  return NextResponse.redirect(back, { status: 303 });
}
