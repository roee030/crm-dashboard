/**
 * Minimal in-memory fixed-window rate limiter. Suitable for single-instance /
 * dev use; swap the store for Redis/Upstash in a multi-instance deployment.
 */
type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();
const MAX_ENTRIES = 10_000;

/**
 * Keep the store hard-bounded: first drop expired buckets, then — if still at the
 * cap — evict the oldest entries (Map preserves insertion order), so a flood of
 * unique keys within one window cannot grow memory without limit.
 */
function enforceCap(now: number) {
  if (store.size < MAX_ENTRIES) return;
  for (const [key, bucket] of store) {
    if (now >= bucket.resetAt) store.delete(key);
  }
  while (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
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
  const existing = store.get(key);
  // Hard-bound the store before inserting a potential new key.
  if (!existing || now >= existing.resetAt) enforceCap(now);

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
 * ⚠️ `x-forwarded-for` is client-controllable unless a trusted proxy overwrites it,
 * and a Web `Request` exposes no socket IP. So:
 *   - Behind a proxy you control, set TRUSTED_PROXY=1 and TRUSTED_PROXY_HEADER to the
 *     header that proxy sets (default `x-real-ip`; e.g. `cf-connecting-ip` on Cloudflare,
 *     `x-vercel-forwarded-for` on Vercel). That header is trusted.
 *   - Otherwise we DO NOT trust client headers and fail closed to a single shared
 *     bucket per scope. This is only used by the public lead form, where the limit is
 *     abuse-dampening, not a security control.
 * Authenticated endpoints key by identity (user id / API-key id), not by this helper.
 * For robust multi-instance limiting, use a shared store (Redis/Upstash) keyed by the
 * platform-provided IP.
 */
export function clientKey(req: Request, scope: string): string {
  if (process.env.TRUSTED_PROXY === "1") {
    const header = process.env.TRUSTED_PROXY_HEADER || "x-real-ip";
    const ip = req.headers.get(header)?.split(",")[0]?.trim();
    if (ip) return `${scope}:${ip}`;
  }
  // Fail closed: no trusted IP source → one shared bucket for this scope.
  return `${scope}:shared`;
}
