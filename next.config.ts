import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Static HTML export (writes `out/`) — no `/api/*` routes. Use only for Capacitor `webDir` sync
 * when you bundle the web assets locally. Vercel must NOT use this: deploy a normal Next build
 * so `/api/generate` and `/api/import` exist as serverless routes.
 *
 * Local: `WISEDISH_STATIC_EXPORT=true npm run build && npx cap sync android`
 */
const staticExport = process.env.WISEDISH_STATIC_EXPORT === "true";
const onVercel = process.env.VERCEL === "1";

if (staticExport && onVercel) {
  throw new Error(
    "WISEDISH_STATIC_EXPORT=true is only for local Android sync. Disable it for Vercel/serverful deployments."
  );
}

/** Changes every Vercel deploy so the client can bust stale WebView caches. */
const WISEDISH_BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "local";

/** Shown in feedback context so we know which app build a tester was on. */
const WISEDISH_APP_VERSION: string = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8")).version;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(staticExport ? { output: "export" as const } : {}),
  env: {
    NEXT_PUBLIC_WISEDISH_BUILD_ID: WISEDISH_BUILD_ID,
    NEXT_PUBLIC_WISEDISH_APP_VERSION: WISEDISH_APP_VERSION,
  },
  turbopack: {
    root: __dirname,
  },
  async headers() {
    if (staticExport) return [];
    return [
      {
        source: "/",
        headers: [{ key: "Cache-Control", value: "private, no-cache, must-revalidate" }],
      },
      {
        source: "/log",
        headers: [{ key: "Cache-Control", value: "private, no-cache, must-revalidate" }],
      },
      {
        source: "/feedback",
        headers: [{ key: "Cache-Control", value: "private, no-cache, must-revalidate" }],
      },
      {
        source: "/privacy",
        headers: [{ key: "Cache-Control", value: "private, no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;

