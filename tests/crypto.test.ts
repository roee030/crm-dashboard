import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret, maybeDecrypt } from "@/lib/crypto";

describe("AES-256-GCM crypto", () => {
  it("round-trips a secret", () => {
    const secret = "pat-na1-super-secret-token-1234567890";
    const enc = encryptSecret(secret);
    expect(enc).not.toContain(secret);
    expect(enc.startsWith("v1:")).toBe(true);
    expect(decryptSecret(enc)).toBe(secret);
  });

  it("produces a fresh IV each call (ciphertext differs)", () => {
    const a = encryptSecret("same-value");
    const b = encryptSecret("same-value");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same-value");
    expect(decryptSecret(b)).toBe("same-value");
  });

  it("round-trips Hebrew (UTF-8) tokens", () => {
    const secret = "סוד-בעברית-12345";
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("maybeDecrypt returns null on tampered/garbage input", () => {
    expect(maybeDecrypt(null)).toBeNull();
    expect(maybeDecrypt("not-encrypted")).toBeNull();
    const enc = encryptSecret("x");
    const tampered = enc.slice(0, -4) + "AAAA";
    expect(maybeDecrypt(tampered)).toBeNull();
  });
});
