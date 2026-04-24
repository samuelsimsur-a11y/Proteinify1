import type { NextConfig } from "next";
import { API_CORS_HEADERS } from "./src/lib/http/cors";

/**
 * Static HTML export (writes `out/`) — no `/api/*` routes. Use only for Capacitor `webDir` sync
 * when you bundle the web assets locally. Vercel must NOT use this: deploy a normal Next build
 * so `/api/generate` and `/api/import` exist as serverless routes.
 *
 * Local: `FOODZAP_STATIC_EXPORT=true npm run build && npx cap sync android`
 */
const staticExport = process.env.FOODZAP_STATIC_EXPORT === "true";
const onVercel = process.env.VERCEL === "1";

if (staticExport && onVercel) {
  throw new Error(
    "FOODZAP_STATIC_EXPORT=true is only for local Android sync. Disable it for Vercel/serverful deployments."
  );
}

/** Changes every Vercel deploy so the client can bust stale WebView caches. */
const FOODZAP_BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "local";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(staticExport ? { output: "export" as const } : {}),
  env: {
    NEXT_PUBLIC_FOODZAP_BUILD_ID: FOODZAP_BUILD_ID,
  },
  turbopack: {
    root: __dirname,
  },
  async headers() {
    if (staticExport) return [];
    return [
      {
        source: "/api/:path*",
        headers: Object.entries(API_CORS_HEADERS).map(([key, value]) => ({ key, value })),
      },
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
    ];
  },
};

export default nextConfig;

