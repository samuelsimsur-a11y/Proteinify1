/**
 * Canonical Wise Dish production origin (no trailing slash).
 * Used by Capacitor, API client fallbacks, and docs — not deployment-hash preview URLs.
 */
export const WISEDISH_PRODUCTION_ORIGIN = "https://wisedish.vercel.app";

/** Legacy Vercel alias from pre-rebrand project name; kept until all clients migrate. */
export const WISEDISH_LEGACY_ORIGINS = [
  "https://foodzap-khaki.vercel.app",
  "https://foodzap-protify.vercel.app",
  "https://proteinify1.vercel.app",
] as const;

export function normalizeOrigin(origin: string): string {
  const t = origin.trim();
  if (!t) return "";
  return t.endsWith("/") ? t.slice(0, -1) : t;
}

export function resolveProductionOrigin(): string {
  const fromEnv = normalizeOrigin(
    process.env.CAPACITOR_SERVER_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      ""
  );
  return fromEnv || WISEDISH_PRODUCTION_ORIGIN;
}

export function productionOriginCandidates(): string[] {
  const out: string[] = [];
  const push = (o: string) => {
    const n = normalizeOrigin(o);
    if (n && !out.includes(n)) out.push(n);
  };
  push(resolveProductionOrigin());
  push(WISEDISH_PRODUCTION_ORIGIN);
  for (const legacy of WISEDISH_LEGACY_ORIGINS) push(legacy);
  return out;
}
