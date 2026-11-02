import { NextResponse } from "next/server";
import { addSubscriber, subscriberCount } from "@/lib/notify";
import { clientIp } from "@/lib/httpx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

// Best-effort, per-instance. Cloudflare rate-limits at the edge; this is the
// second line of defence so a single IP cannot flood the file.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, { n: number; t: number }>();

export async function POST(req: Request) {
  const now = Date.now();
  // Same lookup as every other route: X-Real-IP first, which Caddy rewrites from
  // the TCP peer. CF-Connecting-IP is client-controllable if the origin is ever
  // reachable directly, so it is only a fallback.
  const ip = clientIp(req);
  const prev = hits.get(ip);
  const fresh = !prev || now - prev.t > WINDOW_MS;
  const n = fresh ? 1 : prev.n + 1;

  if (n > MAX_PER_WINDOW) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  hits.set(ip, { n, t: fresh ? now : prev.t });

  if (hits.size > 5000) hits.clear(); // unbounded map guard

  let email = "";
  try {
    const body = (await req.json()) as { email?: unknown; company?: unknown };
    if (typeof body.company === "string" && body.company.length > 0) {
      // Honeypot filled: pretend success, store nothing.
      return NextResponse.json({ ok: true });
    }
    if (typeof body.email !== "string") {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }
    email = body.email.trim().toLowerCase();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  if (email.length < 5 || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  try {
    const result = await addSubscriber(email);
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 500 });
  }
}

export async function GET() {
  try {
    return NextResponse.json({ count: await subscriberCount() });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
