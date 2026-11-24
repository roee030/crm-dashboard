/**
 * Minimal in-memory fixed-window rate limiter. Suitable for single-instance /
 * dev use; swap the store for Redis/Upstash in a multi-instance deployment.
 */
type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();
const MAX_ENTRIES = 10_000;

/** Drop expired buckets so the in-memory store can't grow without bound. */
function evictExpired(now: number) {
  for (const [key, bucket] of store) {
    if (now >= bucket.resetAt) store.delete(key);
  }
}

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
  // Bound memory: sweep expired entries when the store gets large.
  if (store.size > MAX_ENTRIES) evictExpired(now);

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

/**
 * Derive a client key from a request IP.
 *
 * ⚠️ `x-forwarded-for` is client-controllable unless a trusted proxy overwrites it.
 * In production, set TRUSTED_PROXY=1 only when running behind a proxy you control
 * (Vercel/Cloudflare/nginx) — then we read `x-real-ip` (set by that proxy). Without
 * it we fall back to the right-most XFF entry (appended by the nearest hop), which is
 * harder to spoof than the left-most. For robust multi-instance limiting, move to a
 * shared store (Redis/Upstash) with TTL.
 */
export function clientKey(req: Request, scope: string): string {
  let ip = "unknown";
  if (process.env.TRUSTED_PROXY === "1") {
    ip = req.headers.get("x-real-ip") || ip;
  } else {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) {
      const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
      ip = parts[parts.length - 1] || ip; // right-most = nearest trusted hop
    }
  }
  return `${scope}:${ip}`;
}
