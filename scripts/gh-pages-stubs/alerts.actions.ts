/**
 * Static-demo stub for src/app/(app)/settings/alerts/actions.ts.
 * Swapped in by scripts/build-gh-pages.mjs for the GitHub Pages export build.
 */
export async function saveAlertRule(_input: {
  webhookUrl: string;
  triggers: string[];
  isActive: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}

export async function sendTestAlert(): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}
