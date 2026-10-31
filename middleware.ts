import { NextResponse, type NextRequest } from "next/server";

/**
 * Site gate.
 *
 * Set SITE_MODE=maintenance on the server and every page except the allowlist
 * below renders the "opens 1 November" page with an email capture. Unset it
 * (or set anything else) and the market is public again — no code change, no
 * rebuild of the routes, one env var and a container restart.
 */

const PUBLIC_PREFIXES = ["/maintenance", "/api", "/_next", "/opengraph-image"];
const PUBLIC_EXACT = new Set([
  "/privacy",
  "/terms",
  "/risk",
  "/cookies",
  "/legal",
  "/rules",
  "/goat-history",
  "/login",
  "/register",
  "/account",
  "/recover",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
]);

export function middleware(req: NextRequest) {
  if (process.env.SITE_MODE !== "maintenance") {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  const isPublic =
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isPublic) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/maintenance";
  url.search = "";

  const res = NextResponse.rewrite(url);
  res.headers.set("Cache-Control", "no-store, max-age=0");
  res.headers.set("Retry-After", "3600");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
