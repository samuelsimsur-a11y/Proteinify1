import type { NextRequest } from "next/server";

const SHORT_STORE_KEY = "__proteinify_generate_ip_rl_short_v1" as const;
const DAILY_STORE_KEY = "__proteinify_generate_ip_rl_daily_v1" as const;

type ShortWindowCounter = { count: number; windowStart: number };
type DailyCounter = { count: number; date: string };

function getShortStore(): Map<string, ShortWindowCounter> {
  const g = globalThis as unknown as Record<string, Map<string, ShortWindowCounter>>;
  if (!g[SHORT_STORE_KEY]) {
    g[SHORT_STORE_KEY] = new Map();
  }
  return g[SHORT_STORE_KEY]!;
}

function getDailyStore(): Map<string, DailyCounter> {
  const g = globalThis as unknown as Record<string, Map<string, DailyCounter>>;
  if (!g[DAILY_STORE_KEY]) {
    g[DAILY_STORE_KEY] = new Map();
  }
  return g[DAILY_STORE_KEY]!;
}

/** Best-effort client IP on Vercel / proxies. */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  // NextRequest doesn't expose connection directly in typing, but this fallback
  // is useful in local/dev environments and some proxies.
  const maybeConn = req as NextRequest & { connection?: { remoteAddress?: string } };
  const remoteAddress = maybeConn.connection?.remoteAddress?.trim();
  if (remoteAddress) return remoteAddress;
  return "unknown";
}

const THREE_MIN_WINDOW_MS = 3 * 60_000;
const MAX_PER_THREE_MIN = 10;
const MAX_PER_DAY = 30;

export function checkGenerateRateLimit(
  ip: string
): { ok: true } | { ok: false; reason: "three-minute" | "daily" } {
  const now = Date.now();
  const shortStore = getShortStore();
  const dailyStore = getDailyStore();
  const today = new Date(now).toISOString().slice(0, 10);

  const currentShort = shortStore.get(ip);
  if (!currentShort || now - currentShort.windowStart >= THREE_MIN_WINDOW_MS) {
    shortStore.set(ip, { count: 1, windowStart: now });
  } else {
    if (currentShort.count >= MAX_PER_THREE_MIN) {
      return { ok: false, reason: "three-minute" };
    }
    currentShort.count += 1;
    shortStore.set(ip, currentShort);
  }

  const currentDaily = dailyStore.get(ip);
  if (!currentDaily || currentDaily.date !== today) {
    dailyStore.set(ip, { count: 1, date: today });
  } else {
    if (currentDaily.count >= MAX_PER_DAY) {
      return { ok: false, reason: "daily" };
    }
    currentDaily.count += 1;
    dailyStore.set(ip, currentDaily);
  }

  // Light memory cleanup for high-cardinality IP traffic.
  if (shortStore.size > 5000) {
    for (const [key, value] of shortStore.entries()) {
      if (now - value.windowStart >= THREE_MIN_WINDOW_MS) {
        shortStore.delete(key);
      }
    }
  }
  if (dailyStore.size > 5000) {
    for (const [key, value] of dailyStore.entries()) {
      if (value.date !== today) {
        dailyStore.delete(key);
      }
    }
  }

  return { ok: true };
}
