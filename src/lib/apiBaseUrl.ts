const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";
const CAPACITOR_PRIMARY_API_BASE_URL = "https://proteinify1.vercel.app";
const CAPACITOR_SECONDARY_API_BASE_URL = "https://foodzap.vercel.app";
const LAST_GOOD_API_ORIGIN_KEY = "foodzap_last_good_api_origin";

/** Stable production API host for cross-origin fallback. */
export const PRODUCTION_FOODZAP_BASE = "https://proteinify1.vercel.app";

function normalizeBase(base: string): string {
  if (!base) return "";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

const API_BASE_URL = normalizeBase(rawBase);

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
    const raw = window.localStorage.getItem(LAST_GOOD_API_ORIGIN_KEY);
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
 * Vercel preview hostnames (`*.vercel.app` except production) also try production FoodZap so
 * static or misconfigured previews still work when APIs exist on production.
 */
export function getApiRequestEndpointCandidates(apiPath: "/api/generate" | "/api/import"): string[] {
  if (!apiPath.startsWith("/")) {
    return [apiPath];
  }

  if (API_BASE_URL) {
    return [joinApiBase(API_BASE_URL, apiPath)];
  }

  if (shouldUseCapacitorFallback()) {
    const out: string[] = [];
    const push = (base: string) => {
      const url = joinApiBase(base, apiPath);
      if (!out.includes(url)) out.push(url);
    };
    push(CAPACITOR_PRIMARY_API_BASE_URL);
    push(CAPACITOR_SECONDARY_API_BASE_URL);
    return orderByLastGoodOrigin(out);
  }

  const endpoints: string[] = [apiPath];

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (protocol !== "https:") return endpoints;

    // foodzap.vercel.app may be a static shell (no /api/*); retry full Next stack.
    if (hostname === "foodzap.vercel.app") {
      const alt = joinApiBase(CAPACITOR_PRIMARY_API_BASE_URL, apiPath);
      if (!endpoints.includes(alt)) endpoints.push(alt);
      return endpoints;
    }

    const onVercelPreview =
      hostname.endsWith(".vercel.app") && hostname !== "foodzap.vercel.app";
    if (onVercelPreview) {
      const fallback = joinApiBase(PRODUCTION_FOODZAP_BASE, apiPath);
      if (!endpoints.includes(fallback)) endpoints.push(fallback);
    }
  }

  return orderByLastGoodOrigin(endpoints);
}
