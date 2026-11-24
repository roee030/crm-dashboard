import type { NextConfig } from "next";

/**
 * Dual-target config.
 *
 * - Default (Vercel / Node): a normal full-stack Next.js app with Server Actions,
 *   Route Handlers and middleware — unchanged.
 * - `GITHUB_PAGES=true`: a fully static export (`output: 'export'`) served from the
 *   `/crm-dashboard` sub-path on GitHub Pages. The build script
 *   (`scripts/build-gh-pages.mjs`) removes the server-only surfaces (middleware,
 *   `app/api`, Server Actions) that static export cannot include, and the UI runs
 *   100% client-side via `NEXT_PUBLIC_STATIC_DEMO=true`.
 */
const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  // Audio uploads can be large; raise the Server Action body limit.
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },

  ...(isGithubPages
    ? {
        output: "export" as const,
        basePath: "/crm-dashboard",
        assetPrefix: "/crm-dashboard/",
        images: { unoptimized: true },
        // The static-demo stubs (swapped in by the build script) are intentionally
        // loose; the standard build + the dedicated `tsc`/lint gates enforce types.
        typescript: { ignoreBuildErrors: true },
        eslint: { ignoreDuringBuilds: true },
      }
    : {}),
};

export default nextConfig;
