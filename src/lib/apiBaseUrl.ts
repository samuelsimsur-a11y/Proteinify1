const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";
const rawFallbacks = process.env.NEXT_PUBLIC_API_FALLBACK_URLS?.trim() ?? "";
const PRODUCTION_API_BASE = "https://foodzap.vercel.app";
const LEGACY_PRODUCTION_API_BASE = "https://proteinify1.vercel.app";
const CAPACITOR_PRIMARY_API_BASE_URL = PRODUCTION_API_BASE;
const CAPACITOR_SECONDARY_API_BASE_URL = LEGACY_PRODUCTION_API_BASE;
const LAST_GOOD_API_ORIGIN_KEY = "wisedish_last_good_api_origin";
const LEGACY_LAST_GOOD_API_ORIGIN_KEY = "foodzap_last_good_api_origin";

/** Stable production API host for cross-origin fallback. */
export const PRODUCTION_WISEDISH_BASE = PRODUCTION_API_BASE;

function normalizeBase(base: string): string {
  if (!base) return "";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

const API_BASE_URL = normalizeBase(rawBase);
const API_FALLBACKS = rawFallbacks
  .split(",")
  .map((s) => normalizeBase(s.trim()))
  .filter(Boolean);

function shouldUseCapacitorFallback(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    Capacitor?: {
      isNativePlatform?: () => boolean;
    };
  };
  if (w.Capacitor?.isNativePlatform?.()) return true;
  const protocol = window.location?.protocol ?? "";
  return protocol === "capacitor:" || protocol === "ionic:";
}

function resolveApiBase(): string {
  if (API_BASE_URL) return API_BASE_URL;
  if (shouldUseCapacitorFallback()) return CAPACITOR_PRIMARY_API_BASE_URL;
  return "";
}

export function getResolvedApiBase(): string {
  return resolveApiBase();
}

export function getApiBaseCandidates(): string[] {
  const unique = new Set<string>();
  if (API_BASE_URL) unique.add(API_BASE_URL);
  for (const fallback of API_FALLBACKS) unique.add(fallback);
  if (shouldUseCapacitorFallback()) {
    unique.add(CAPACITOR_PRIMARY_API_BASE_URL);
    unique.add(CAPACITOR_SECONDARY_API_BASE_URL);
  }
  return Array.from(unique);
}

export function joinApiBase(base: string, path: string): string {
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}

function getLastGoodApiOrigin(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.localStorage.getItem(LAST_GOOD_API_ORIGIN_KEY) ??
      window.localStorage.getItem(LEGACY_LAST_GOOD_API_ORIGIN_KEY);
    if (!raw) return null;
    return normalizeBase(raw);
  } catch {
    return null;
  }
}

function orderByLastGoodOrigin(endpoints: string[]): string[] {
  const lastGood = getLastGoodApiOrigin();
  if (!lastGood) return endpoints;
  return [...endpoints].sort((a, b) => {
    const aMatch = a.startsWith(lastGood) ? 0 : 1;
    const bMatch = b.startsWith(lastGood) ? 0 : 1;
    return aMatch - bMatch;
  });
}

export function withApiBase(path: string): string {
  const base = resolveApiBase();
  if (!path.startsWith("/")) return base ? `${base}/${path}` : `/${path}`;
  return base ? `${base}${path}` : path;
}

export function markApiEndpointSuccess(endpoint: string): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(endpoint, window.location.origin);
    if (!url.origin.startsWith("http")) return;
    window.localStorage.setItem(LAST_GOOD_API_ORIGIN_KEY, normalizeBase(url.origin));
    window.localStorage.removeItem(LEGACY_LAST_GOOD_API_ORIGIN_KEY);
  } catch {
    // ignore malformed endpoint
  }
}

export function isLikelyOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.onLine === false;
}

/**
 * Ordered endpoints to POST for this route (relative first on web = same deployment).
 * Vercel preview hostnames (`*.vercel.app` except production) also try production Wise Dish so
 * static or misconfigured previews still work when APIs exist on production.
 */
export function getApiRequestEndpointCandidates(apiPath: "/api/generate" | "/api/import"): string[] {
  if (!apiPath.startsWith("/")) {
    return [apiPath];
  }

  if (API_BASE_URL) {
    const bases = [API_BASE_URL, ...API_FALLBACKS];
    return orderByLastGoodOrigin(bases.map((base) => joinApiBase(base, apiPath)));
  }

  if (shouldUseCapacitorFallback()) {
    const out: string[] = [];
    const push = (base: string) => {
      const url = joinApiBase(base, apiPath);
      if (!out.includes(url)) out.push(url);
    };
    push(CAPACITOR_PRIMARY_API_BASE_URL);
    push(CAPACITOR_SECONDARY_API_BASE_URL);
    for (const fallback of API_FALLBACKS) push(fallback);
    return orderByLastGoodOrigin(out);
  }

  const endpoints: string[] = [apiPath];

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (protocol !== "https:") return endpoints;

    // If this host is static-only, retry against explicit production API host.
    if (hostname === new URL(PRODUCTION_API_BASE).hostname) {
      const alt = joinApiBase(CAPACITOR_PRIMARY_API_BASE_URL, apiPath);
      if (!endpoints.includes(alt)) endpoints.push(alt);
      return endpoints;
    }

    const onVercelPreview =
      hostname.endsWith(".vercel.app") && hostname !== new URL(PRODUCTION_API_BASE).hostname;
    if (onVercelPreview) {
      const fallback = joinApiBase(PRODUCTION_WISEDISH_BASE, apiPath);
      if (!endpoints.includes(fallback)) endpoints.push(fallback);
    }
  }

  return orderByLastGoodOrigin(endpoints);
}
