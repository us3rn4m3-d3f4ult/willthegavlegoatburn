import { NextResponse, type NextRequest } from "next/server";

/**
 * CSP notes, because this is easy to get wrong — again.
 *
 * Tried on 2 Nov 2026: per-response nonce, set on the *request* headers as the
 * Next docs describe (`x-nonce` + `Content-Security-Policy`), with
 * `script-src 'self' 'nonce-…' 'strict-dynamic'`. Measured on the live page:
 * **45 `<script>` tags, 1 with a nonce** — Next 15.5 does not stamp the flight
 * data scripts, so `'strict-dynamic'` blocked hydration. Same result as the
 * earlier attempt (3 of 32). Do not retry this without re-measuring.
 *
 * So: `'self' 'unsafe-inline'` for scripts (third-party origins still blocked),
 * plus `script-src-attr 'none'`, which kills inline event handlers — the
 * payload an HTML injection actually needs. Framing, object/embed, base-uri and
 * form-action are all locked down.
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
    // No inline event handlers: React never emits them, and they are how an HTML
    // injection usually executes. This is the part of F-04 that is enforceable.
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.giphy.com https://i.giphy.com https://*.walletconnect.com https://*.walletconnect.org https://*.reown.com https://*.web3modal.com",
    "font-src 'self' data:",
    // Chain RPC and wallet transport. Keep this list explicit: adding a wildcard
    // here is how wallet-drainer scripts get to phone home.
    [
      "connect-src 'self'",
      rpcOrigin,
      "https://sepolia.base.org",
      "https://mainnet.base.org",
      // GIPHY requires its search call to come from the client, so the browser
      // talks to api.giphy.com directly. The images themselves are covered by
      // `img-src ... https:`.
      "https://api.giphy.com",
      "https://*.walletconnect.com",
      "wss://*.walletconnect.com",
      "https://*.walletconnect.org",
      "wss://*.walletconnect.org",
      "https://*.web3modal.com",
      "https://*.web3modal.org",
      "https://*.reown.com",
      "https://pulse.walletconnect.org",
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
