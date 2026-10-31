export function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** Fixed-window, per-process limiter. Cloudflare rate limits at the edge too. */
export function createLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { n: number; t: number }>();
  return function allow(key: string): boolean {
    const now = Date.now();
    const prev = hits.get(key);
    const fresh = !prev || now - prev.t > windowMs;
    const n = fresh ? 1 : (prev?.n ?? 0) + 1;
    if (hits.size > 5000) hits.clear();
    if (n > max) return false;
    hits.set(key, { n, t: fresh ? now : (prev?.t ?? now) });
    return true;
  };
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
