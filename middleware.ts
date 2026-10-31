import { NextResponse, type NextRequest } from "next/server";

/**
 * CSP notes, because this is easy to get wrong.
 *
 * Next 15 only stamps a nonce onto *some* of its own script tags (we measured
 * 3 of 32), so a nonce-based `script-src` blocks the hydration chunks and the
 * page renders but never becomes interactive. `'strict-dynamic'` cannot be used
 * either: its presence makes browsers ignore `'self'` entirely.
 *
 * So scripts are `'self' 'unsafe-inline'`. That still blocks third-party script
 * origins, framing and object embedding — the classes of attack that matter for
 * a wallet front-end — but it does **not** mitigate inline XSS. See
 * docs/SECURITY_AUDIT.md, finding F-04, for the plan to tighten this.
 */
const PUBLIC_PREFIXES = ["/maintenance", "/api", "/_next", "/opengraph-image"];
const PUBLIC_EXACT = new Set([
  "/privacy",
  "/terms",
  "/risk",
  "/cookies",
  "/goat-history",
  "/login",
  "/register",
  "/account",
  "/recover",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
]);

function contentSecurityPolicy(isDev: boolean): string {
  const scriptExtra = isDev ? " 'unsafe-eval'" : "";

  // The browser talks to the RPC directly, so its origin must be allowed or every
  // client-side read (balances, quotes, expiry) fails silently. Derived from the
  // build-time env rather than hardcoded, so switching RPC providers cannot leave
  // this list stale — which is exactly what happened when we moved to Alchemy.
  const rpcOrigin = (() => {
    const raw = process.env.NEXT_PUBLIC_RPC_URL ?? "";
    try {
      return raw ? new URL(raw).origin : "";
    } catch {
      return "";
    }
  })();

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${scriptExtra}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Chain RPC and wallet transport. Keep this list explicit: adding a wildcard
    // here is how wallet-drainer scripts get to phone home.
    [
      "connect-src 'self'",
      rpcOrigin,
      "https://sepolia.base.org",
      "https://mainnet.base.org",
      "https://*.walletconnect.com",
      "wss://*.walletconnect.com",
      "https://*.coinbase.com",
    ]
      .filter(Boolean)
      .join(" "),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function middleware(req: NextRequest) {
  const policy = contentSecurityPolicy(process.env.NODE_ENV !== "production");

  const { pathname } = req.nextUrl;
  const gated = process.env.SITE_MODE === "maintenance";
  const isPublic =
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  let res: NextResponse;

  if (gated && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/maintenance";
    url.search = "";
    res = NextResponse.rewrite(url);
    res.headers.set("Cache-Control", "no-store, max-age=0");
    res.headers.set("Retry-After", "3600");
  } else {
    res = NextResponse.next();
  }

  res.headers.set("content-security-policy", policy);
  res.headers.set("x-content-type-options", "nosniff");
  res.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
