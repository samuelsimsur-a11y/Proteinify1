const STORE_KEY = "__proteinify_import_ip_rl_v1" as const;

type Timestamps = number[];

function getStore(): Map<string, Timestamps> {
  const g = globalThis as unknown as Record<string, Map<string, Timestamps>>;
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = new Map();
  }
  return g[STORE_KEY]!;
}

const THREE_MIN_WINDOW_MS = 3 * 60_000;
const DAY_WINDOW_MS = 24 * 60 * 60_000;
const MAX_PER_THREE_MIN = 5;
const MAX_PER_DAY = 15;

export function checkImportRateLimit(
  ip: string
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const store = getStore();

  let hits = store.get(ip) ?? [];
  hits = hits.filter((t) => now - t < DAY_WINDOW_MS);

  const hitsThreeMin = hits.filter((t) => now - t < THREE_MIN_WINDOW_MS);
  if (hitsThreeMin.length >= MAX_PER_THREE_MIN) {
    const oldest = hitsThreeMin[0]!;
    const retryAfterMs = Math.max(0, THREE_MIN_WINDOW_MS - (now - oldest)) + 100;
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  if (hits.length >= MAX_PER_DAY) {
    const oldest = hits[0]!;
    const retryAfterMs = Math.max(0, DAY_WINDOW_MS - (now - oldest)) + 100;
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  hits.push(now);
  store.set(ip, hits);

  if (store.size > 5000) {
    for (const key of store.keys()) {
      const arr = store.get(key)!.filter((t) => now - t < DAY_WINDOW_MS);
      if (arr.length === 0) store.delete(key);
      else store.set(key, arr);
    }
  }

  return { ok: true };
}
