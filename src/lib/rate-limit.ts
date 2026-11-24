/**
 * Minimal in-memory fixed-window rate limiter for single-instance / dev use.
 *
 * Production note: this is best-effort. For multi-instance or hostile traffic use a
 * shared store with TTL (Redis/Upstash) keyed by a platform-provided client IP. The
 * limiter below never evicts a *live* bucket (which would reset a victim's counter);
 * at the memory cap it fails closed for new keys instead.
 */
type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();
const MAX_ENTRIES = 50_000;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetMs: number;
};

function pruneExpired(now: number) {
  for (const [key, bucket] of store) {
    if (now >= bucket.resetAt) store.delete(key);
  }
}

export function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
  now: number = Date.now(),
): RateLimitResult {
  const existing = store.get(key);

  // Active bucket: count within the current window.
  if (existing && now < existing.resetAt) {
    if (existing.count >= opts.limit) {
      return { ok: false, remaining: 0, resetMs: existing.resetAt - now };
    }
    existing.count += 1;
    return { ok: true, remaining: opts.limit - existing.count, resetMs: existing.resetAt - now };
  }

  // New or expired key needs a slot. Bound memory WITHOUT evicting live buckets.
  if (!existing && store.size >= MAX_ENTRIES) {
    pruneExpired(now);
    if (store.size >= MAX_ENTRIES) {
      // Fail closed rather than reset another key's live counter.
      return { ok: false, remaining: 0, resetMs: opts.windowMs };
    }
  }

  const resetAt = now + opts.windowMs;
  store.set(key, { count: 1, resetAt });
  return { ok: true, remaining: opts.limit - 1, resetMs: opts.windowMs };
}

/** Test/maintenance helper. */
export function __resetRateLimitStore() {
  store.clear();
}

/**
 * Derive a rate-limit key from a request IP.
 *
 * ⚠️ `x-forwarded-for` is client-controllable and a Web `Request` exposes no socket
 * IP. Only trust a proxy header when TRUSTED_PROXY=1 (set TRUSTED_PROXY_HEADER to the
 * header your proxy sets — e.g. `cf-connecting-ip`, `x-vercel-forwarded-for`,
 * `x-real-ip`). Otherwise we DO NOT trust client headers and use one shared key per
 * scope — acceptable only because this helper is used by the public lead form, where
 * the limit is abuse-dampening, not a security control. Authenticated endpoints key by
 * identity (user id / API-key id) instead. Use Redis keyed by the platform IP in prod.
 */
export function clientKey(req: Request, scope: string): string {
  if (process.env.TRUSTED_PROXY === "1") {
    const header = process.env.TRUSTED_PROXY_HEADER || "x-real-ip";
    const ip = req.headers.get(header)?.split(",")[0]?.trim();
    if (ip) return `${scope}:${ip}`;
  }
  return `${scope}:shared`;
}
