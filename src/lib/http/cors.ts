import { WISEDISH_LEGACY_ORIGINS, WISEDISH_PRODUCTION_ORIGIN, normalizeOrigin } from "@/lib/wisedish/productionOrigin";

/**
 * CORS for /api/*: only the Wise Dish web app, the Android app (Capacitor serves from
 * https://localhost) and local dev may call the API from a browser. Requests without an
 * Origin header (native code, curl, server-to-server) are unaffected by CORS.
 * Extra origins: comma-separated CORS_ALLOWED_ORIGINS env var.
 */
const BASE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-Request-Id",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

/** Vercel preview hosts for this project (and its pre-rebrand names). */
const PREVIEW_HOST_RE = /^(wisedish|foodzap|proteinify1?)(-[a-z0-9-]+)?\.vercel\.app$/i;

function configuredOrigins(): Set<string> {
  const out = new Set<string>([WISEDISH_PRODUCTION_ORIGIN, ...WISEDISH_LEGACY_ORIGINS]);
  for (const raw of [process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXT_PUBLIC_API_BASE_URL]) {
    const n = normalizeOrigin(raw ?? "");
    if (n) out.add(n);
  }
  for (const raw of (process.env.CORS_ALLOWED_ORIGINS ?? "").split(",")) {
    const n = normalizeOrigin(raw);
    if (n) out.add(n);
  }
  return out;
}

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  if (process.env.CORS_ALLOW_ALL === "true") return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  // Capacitor WebView (https://localhost, capacitor://localhost) and local development.
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (url.protocol === "https:" && PREVIEW_HOST_RE.test(host)) return true;
  return configuredOrigins().has(normalizeOrigin(origin));
}

export function corsHeadersFor(origin: string | null | undefined): Record<string, string> {
  if (!isAllowedOrigin(origin)) return { ...BASE_HEADERS };
  return { ...BASE_HEADERS, "Access-Control-Allow-Origin": origin! };
}

export function withCorsHeaders(origin: string | null | undefined, headers?: HeadersInit): Headers {
  const out = new Headers(corsHeadersFor(origin));
  if (!headers) return out;
  new Headers(headers).forEach((value, key) => out.set(key, value));
  return out;
}

export function originOf(req: Request): string | null {
  return req.headers.get("origin");
}
