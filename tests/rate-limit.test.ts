import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, __resetRateLimitStore } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => __resetRateLimitStore());

  it("allows up to the limit then blocks", () => {
    const opts = { limit: 3, windowMs: 1000 };
    expect(checkRateLimit("k", opts, 0).ok).toBe(true);
    expect(checkRateLimit("k", opts, 0).ok).toBe(true);
    expect(checkRateLimit("k", opts, 0).ok).toBe(true);
    const blocked = checkRateLimit("k", opts, 0);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after the window elapses", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(checkRateLimit("k", opts, 0).ok).toBe(true);
    expect(checkRateLimit("k", opts, 500).ok).toBe(false);
    expect(checkRateLimit("k", opts, 1001).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(checkRateLimit("a", opts, 0).ok).toBe(true);
    expect(checkRateLimit("b", opts, 0).ok).toBe(true);
  });
});
