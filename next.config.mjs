/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // A strict CSP with a per-request nonce is added at the Caddy layer once
  // the wallet/connect stack is wired (wagmi injects inline scripts).
  async headers() {
    return [
      {
        // Documents must not be cached: they reference build output by content
        // hash, so a page cached across a deploy requests chunks that no longer
        // exist and React reports "a client-side exception has occurred".
        source: "/:path*",
        has: [{ type: "header", key: "accept", value: ".*text/html.*" }],
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
