import type { NextRequest } from "next/server";

const STORE_KEY = "__proteinify_generate_ip_rl_v1" as const;

type Timestamps = number[];

function getStore(): Map<string, Timestamps> {
  const g = globalThis as unknown as Record<string, Map<string, Timestamps>>;
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = new Map();
  }
  return g[STORE_KEY]!;
}

/** Best-effort client IP on Vercel / proxies. */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

const DEFAULT_MAX = 10;
const DEFAULT_WINDOW_MS = 60_000;

/**
 * Sliding window: max `max` hits per `windowMs` per IP.
 * Uses `globalThis` so warm serverless isolates retain counts (not perfect across
 * all Vercel instances — upgrade to Redis/Upstash for strict global limits).
 */
export function checkGenerateRateLimit(
  ip: string,
  options?: { max?: number; windowMs?: number }
): { ok: true } | { ok: false; retryAfterSec: number } {
  const max = options?.max ?? DEFAULT_MAX;
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const now = Date.now();
  const store = getStore();

  let hits = store.get(ip) ?? [];
  hits = hits.filter((t) => now - t < windowMs);

  if (hits.length >= max) {
    const oldest = hits[0]!;
    const retryAfterMs = Math.max(0, windowMs - (now - oldest)) + 100;
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  hits.push(now);
  store.set(ip, hits);

  // Cap memory if map grows (e.g. many unique IPs in dev)
  if (store.size > 5000) {
    for (const key of store.keys()) {
      const arr = store.get(key)!.filter((t) => now - t < windowMs);
      if (arr.length === 0) store.delete(key);
      else store.set(key, arr);
    }
  }

  return { ok: true };
}
