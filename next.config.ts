import type { NextConfig } from "next";

/**
 * Static HTML export (writes `out/`) — no `/api/*` routes. Use only for Capacitor `webDir` sync
 * when you bundle the web assets locally. Vercel must NOT use this: deploy a normal Next build
 * so `/api/generate` and `/api/import` exist as serverless routes.
 *
 * Local: `FOODZAP_STATIC_EXPORT=true npm run build && npx cap sync android`
 */
const staticExport = process.env.FOODZAP_STATIC_EXPORT === "true";

/** Changes every Vercel deploy so the client can bust stale WebView caches. */
const FOODZAP_BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "local";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(staticExport ? { output: "export" as const } : {}),
  env: {
    NEXT_PUBLIC_FOODZAP_BUILD_ID: FOODZAP_BUILD_ID,
  },
  outputFileTracingIncludes: {
    "/api/fz-mark": ["./public/brand/foodzap-mark.png"],
  },
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    if (staticExport) return [];
    return [
      { source: "/brand/foodzap-mark", destination: "/api/fz-mark" },
      { source: "/brand/foodzap-mark.png", destination: "/api/fz-mark" },
      { source: "/api/foodzap-logo", destination: "/api/fz-mark" },
    ];
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
    ];
  },
};

export default nextConfig;

