import { describe, it, expect } from "vitest";
import {
  generateApiKey,
  sha256Hex,
  timingSafeEqualHex,
  looksLikeApiKey,
  keyPrefix,
} from "@/lib/api-keys";

describe("API key hashing", () => {
  it("generates sd_live_ keys with a 16-char prefix and matching hash", () => {
    const { raw, prefix, hash } = generateApiKey();
    expect(looksLikeApiKey(raw)).toBe(true);
    expect(prefix).toHaveLength(16);
    expect(raw.startsWith(prefix)).toBe(true);
    expect(hash).toBe(sha256Hex(raw));
    expect(hash).toHaveLength(64);
  });

  it("produces unique keys", () => {
    expect(generateApiKey().raw).not.toBe(generateApiKey().raw);
  });

  it("timingSafeEqualHex is true for equal, false for different digests", () => {
    const a = sha256Hex("secret");
    expect(timingSafeEqualHex(a, sha256Hex("secret"))).toBe(true);
    expect(timingSafeEqualHex(a, sha256Hex("other"))).toBe(false);
  });

  it("timingSafeEqualHex returns false for different lengths / empty", () => {
    expect(timingSafeEqualHex("ab", "abcd")).toBe(false);
    expect(timingSafeEqualHex("", "")).toBe(false);
  });

  it("looksLikeApiKey rejects malformed tokens", () => {
    expect(looksLikeApiKey("sk_live_x")).toBe(false);
    expect(looksLikeApiKey("sd_live_" + "z".repeat(48))).toBe(false); // non-hex
    expect(looksLikeApiKey("")).toBe(false);
  });

  it("keyPrefix extracts the first 16 chars", () => {
    expect(keyPrefix("sd_live_0123456789abcdef")).toBe("sd_live_01234567");
  });
});
