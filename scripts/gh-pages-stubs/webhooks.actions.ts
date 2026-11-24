/**
 * Static-demo stub for src/app/(app)/settings/webhooks/actions.ts.
 * Swapped in by scripts/build-gh-pages.mjs for the GitHub Pages export build.
 * Simulates key management client-side (no server, no real secrets).
 */
export type ApiKeyView = {
  id: string;
  label: string | null;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

function randomSuffix(len: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export async function createKey(
  label: string,
): Promise<{ ok: true; raw: string; view: ApiKeyView } | { ok: false; error: string }> {
  const prefix = `sd_live_${randomSuffix(6)}`;
  const raw = `${prefix}${randomSuffix(42)}`;
  return {
    ok: true,
    raw,
    view: {
      id: `demo-${randomSuffix(8)}`,
      label: label || "Ingestion key",
      key_prefix: prefix,
      last_used_at: null,
      revoked_at: null,
      created_at: new Date().toISOString(),
    },
  };
}

export async function revokeKey(_id: string): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}

export async function sendTestCall(): Promise<{ ok: true; callId: string } | { ok: false; error: string }> {
  return { ok: true, callId: "d0000000-0000-0000-0000-000000000001" };
}
