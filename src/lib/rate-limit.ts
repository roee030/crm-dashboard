/**
 * Minimal in-memory fixed-window rate limiter. Suitable for single-instance /
 * dev use; swap the store for Redis/Upstash in a multi-instance deployment.
 */
type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetMs: number;
};

export function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
  now: number = Date.now(),
): RateLimitResult {
  const existing = store.get(key);

  if (!existing || now >= existing.resetAt) {
    const resetAt = now + opts.windowMs;
    store.set(key, { count: 1, resetAt });
    return { ok: true, remaining: opts.limit - 1, resetMs: opts.windowMs };
  }

  if (existing.count >= opts.limit) {
    return { ok: false, remaining: 0, resetMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { ok: true, remaining: opts.limit - existing.count, resetMs: existing.resetAt - now };
}

/** Test/maintenance helper. */
export function __resetRateLimitStore() {
  store.clear();
}

/** Derive a client key from a request (best-effort IP, else a constant). */
export function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || req.headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}
