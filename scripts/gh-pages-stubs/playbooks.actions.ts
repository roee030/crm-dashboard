/**
 * Static-demo stub for src/app/(app)/settings/playbooks/actions.ts.
 * Swapped in by scripts/build-gh-pages.mjs for the GitHub Pages export build.
 */
import type { Criterion } from "@/lib/playbooks/scoring";

type Result = { ok: true } | { ok: false; error: string };

export async function updatePlaybook(
  _id: string,
  _patch: { name: string; description: string; criteria: Criterion[] },
): Promise<Result> {
  return { ok: true };
}

export async function setDefaultPlaybook(_id: string): Promise<Result> {
  return { ok: true };
}
