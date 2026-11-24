import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const PREFIX_LEN = 16; // "sd_live_" + 8 chars

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/** Constant-time comparison of two hex digests of equal length. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Generate a new ingestion key: the raw secret (shown once), its prefix, and hash. */
export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const rand = crypto.randomBytes(24).toString("hex");
  const raw = `sd_live_${rand}`;
  return { raw, prefix: raw.slice(0, PREFIX_LEN), hash: sha256Hex(raw) };
}

export function keyPrefix(token: string): string {
  return token.slice(0, PREFIX_LEN);
}

export function looksLikeApiKey(token: string): boolean {
  return /^sd_live_[0-9a-f]{48}$/.test(token);
}

/**
 * Authenticate a raw bearer token against stored hashes using constant-time
 * comparison. Returns the workspace + key id on success (and stamps last_used_at),
 * or null. The key_hash never leaves the server.
 */
export async function authenticateApiKey(
  token: string,
): Promise<{ workspaceId: string; keyId: string } | null> {
  if (!looksLikeApiKey(token)) return null;

  const db = createAdminClient();
  const { data: rows } = await db
    .from("workspace_api_keys")
    .select("id, workspace_id, key_hash, revoked_at")
    .eq("key_prefix", keyPrefix(token));
  if (!rows || rows.length === 0) return null;

  const providedHash = sha256Hex(token);
  for (const row of rows) {
    if (row.revoked_at) continue;
    if (timingSafeEqualHex(providedHash, row.key_hash)) {
      await db
        .from("workspace_api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", row.id);
      return { workspaceId: row.workspace_id, keyId: row.id };
    }
  }
  return null;
}
