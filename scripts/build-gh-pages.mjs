#!/usr/bin/env node
/**
 * Static export build for GitHub Pages (https://roee030.github.io/crm-dashboard/).
 *
 * Next.js `output: 'export'` cannot include a Node runtime, so it rejects
 * middleware, dynamic Route Handlers (`src/app/api/**`) and Server Actions. This
 * script temporarily removes those server-only surfaces, swaps each Server Action
 * module for a client-safe simulation stub, runs the export build with
 * `GITHUB_PAGES=true NEXT_PUBLIC_STATIC_DEMO=true`, writes `out/.nojekyll`, and
 * ALWAYS restores the working tree in a `finally` block — so the standard
 * full-stack build (`npm run build`) is never affected.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const STASH = path.join(ROOT, ".gh-pages-stash");
const STUBS = path.join(ROOT, "scripts", "gh-pages-stubs");

const p = (...parts) => path.join(ROOT, ...parts);

// Server-only directories/files that static export can't include.
const RELOCATIONS = [
  { orig: p("src", "middleware.ts"), stashed: path.join(STASH, "middleware.ts") },
  { orig: p("src", "app", "api"), stashed: path.join(STASH, "api") },
  // The Supabase auth-code callback is a Request-based Route Handler (not under
  // app/api) — also unsupported by static export.
  { orig: p("src", "app", "auth"), stashed: path.join(STASH, "auth-callback") },
];

// Server Action modules → their client-safe static stubs.
const ACTION_SWAPS = [
  { key: "auth", orig: p("src", "app", "(auth)", "actions.ts") },
  { key: "webhooks", orig: p("src", "app", "(app)", "settings", "webhooks", "actions.ts") },
  { key: "alerts", orig: p("src", "app", "(app)", "settings", "alerts", "actions.ts") },
  { key: "playbooks", orig: p("src", "app", "(app)", "settings", "playbooks", "actions.ts") },
  { key: "integrations", orig: p("src", "app", "(app)", "settings", "integrations", "actions.ts") },
].map((s) => ({
  ...s,
  stashed: path.join(STASH, `${s.key}.actions.ts`),
  stub: path.join(STUBS, `${s.key}.actions.ts`),
}));

const exists = (f) => fs.existsSync(f);
const rm = (f) => fs.rmSync(f, { recursive: true, force: true });
const move = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
};

/** Idempotent restore: put every stashed original back where it belongs. */
function restoreAll() {
  for (const { orig, stashed } of ACTION_SWAPS) {
    if (exists(stashed)) {
      if (exists(orig)) rm(orig); // remove the swapped-in stub
      move(stashed, orig);
    }
  }
  for (const { orig, stashed } of RELOCATIONS) {
    if (exists(stashed)) {
      if (exists(orig)) rm(orig);
      move(stashed, orig);
    }
  }
  if (exists(STASH)) {
    try {
      if (fs.readdirSync(STASH).length === 0) fs.rmdirSync(STASH);
    } catch {
      /* non-empty or in use — leave it */
    }
  }
}

function stashAll() {
  fs.mkdirSync(STASH, { recursive: true });
  for (const { orig, stashed } of RELOCATIONS) {
    if (exists(orig)) move(orig, stashed);
  }
  for (const { orig, stashed, stub } of ACTION_SWAPS) {
    if (!exists(stub)) throw new Error(`Missing static stub: ${stub}`);
    if (exists(orig)) move(orig, stashed);
    fs.copyFileSync(stub, orig);
  }
}

function main() {
  // Clean up any leftovers from a previous interrupted run.
  restoreAll();

  let buildStatus = 1;
  try {
    stashAll();

    console.log("▶ Building static export (GITHUB_PAGES=true NEXT_PUBLIC_STATIC_DEMO=true)…");
    const res = spawnSync("npx next build", {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        GITHUB_PAGES: "true",
        NEXT_PUBLIC_STATIC_DEMO: "true",
        NEXT_PUBLIC_BASE_PATH: "/crm-dashboard",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    });
    buildStatus = res.status ?? 1;

    if (buildStatus === 0) {
      const outDir = p("out");
      if (!exists(outDir)) throw new Error("Export finished but ./out was not produced.");
      // Disable GitHub Pages Jekyll processing (so _next/ assets are served).
      fs.writeFileSync(path.join(outDir, ".nojekyll"), "");
      console.log("✔ Static export complete → ./out (with .nojekyll)");
    } else {
      console.error(`✖ next build failed with exit code ${buildStatus}`);
    }
  } finally {
    restoreAll();
    console.log("✔ Working tree restored (middleware, app/api, Server Actions).");
  }

  process.exit(buildStatus);
}

main();
