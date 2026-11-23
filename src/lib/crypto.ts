import crypto from "crypto";

/**
 * AES-256-GCM encryption for secrets at rest (CRM tokens).
 * Serialized format: "v1:<iv b64>:<authTag b64>:<ciphertext b64>".
 *
 * ENCRYPTION_KEY may be a 32-byte base64 string (preferred) or any string, in
 * which case it is hashed to 32 bytes with SHA-256.
 */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY is not set");
  const asB64 = Buffer.from(raw, "base64");
  if (asB64.length === 32) return asB64;
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Malformed encrypted payload");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

export function maybeDecrypt(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    return decryptSecret(payload);
  } catch {
    return null;
  }
}
