/**
 * "I cooked this" log + Protein Bank: lifetime protein added by dishes the cook actually made,
 * weekly cooking streak and milestones. Stored on device only (same storage as My recipes).
 */

import { isCapacitorNative } from "@/lib/capacitorEnv";

export type CookRating = 2 | 1 | 0 | -1;

export type CookEntry = {
  id: string;
  dish: string;
  versionId: string;
  versionLabel: string;
  /** Protein added per serving vs the original dish. */
  proteinAddedG: number;
  totalProteinG: number;
  servings: number;
  rating: CookRating;
  cookedAt: number;
};

export type ProteinBankStats = {
  totalAddedG: number;
  dishesCooked: number;
  uniqueDishes: number;
  weekStreak: number;
  nextMilestoneG: number | null;
  lastMilestoneG: number | null;
};

const STORAGE_KEY = "wisedish_cook_log_v1";
const MAX_ENTRIES = 500;
export const COOK_LOG_EVENT = "wisedish-cook-log-updated";
export const PROTEIN_MILESTONES_G = [100, 250, 500, 1000, 2500, 5000, 10000] as const;

let memory: CookEntry[] | null = null;
let nativeLoaded = false;

function parse(raw: string | null | undefined): CookEntry[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v.filter((e) => e && typeof e === "object" && typeof e.cookedAt === "number") as CookEntry[]) : [];
  } catch {
    return [];
  }
}

function readLocal(): CookEntry[] {
  try {
    return parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function getCookLog(): CookEntry[] {
  if (typeof window === "undefined") return [];
  if (memory) return memory;
  memory = readLocal();
  return memory;
}

/** On Android, localStorage can be wiped with the WebView cache; Capacitor Preferences is the durable copy. */
export async function initCookLogNativeStorage(): Promise<void> {
  if (typeof window === "undefined" || nativeLoaded || !isCapacitorNative()) return;
  nativeLoaded = true;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const fromPrefs = parse((await Preferences.get({ key: STORAGE_KEY })).value);
    const byId = new Map<string, CookEntry>();
    for (const e of [...fromPrefs, ...readLocal()]) byId.set(e.id, e);
    memory = Array.from(byId.values()).sort((a, b) => a.cookedAt - b.cookedAt).slice(-MAX_ENTRIES);
    window.dispatchEvent(new Event(COOK_LOG_EVENT));
  } catch {
    nativeLoaded = false;
  }
}

function persist(entries: CookEntry[]): void {
  memory = entries;
  const serialized = JSON.stringify(entries);
  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    /* ignore */
  }
  if (isCapacitorNative()) {
    void import("@capacitor/preferences")
      .then(({ Preferences }) => Preferences.set({ key: STORAGE_KEY, value: serialized }))
      .catch(() => {});
  }
  window.dispatchEvent(new Event(COOK_LOG_EVENT));
}

/** Monday-based week index, so "this week" matches how people plan cooking. */
function weekIndex(ts: number): number {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return Math.round(monday.getTime() / (7 * 24 * 3600 * 1000));
}

export function computeStats(entries: CookEntry[], now: number = Date.now()): ProteinBankStats {
  const totalAddedG = Math.round(entries.reduce((sum, e) => sum + Math.max(0, e.proteinAddedG) * Math.max(1, e.servings), 0));
  const weeks = new Set(entries.map((e) => weekIndex(e.cookedAt)));
  let streak = 0;
  let w = weekIndex(now);
  // A streak survives until the current week is over: count from last week if nothing cooked yet this week.
  if (!weeks.has(w)) w -= 1;
  while (weeks.has(w)) {
    streak += 1;
    w -= 1;
  }
  const nextMilestoneG = PROTEIN_MILESTONES_G.find((m) => m > totalAddedG) ?? null;
  const reached = PROTEIN_MILESTONES_G.filter((m) => m <= totalAddedG);
  return {
    totalAddedG,
    dishesCooked: entries.length,
    uniqueDishes: new Set(entries.map((e) => e.dish.trim().toLowerCase())).size,
    weekStreak: streak,
    nextMilestoneG,
    lastMilestoneG: reached.length ? reached[reached.length - 1]! : null,
  };
}

export function logCooked(entry: Omit<CookEntry, "id" | "cookedAt">): {
  entry: CookEntry;
  stats: ProteinBankStats;
  newMilestoneG: number | null;
} {
  const before = computeStats(getCookLog());
  const full: CookEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    cookedAt: Date.now(),
  };
  const next = [...getCookLog(), full].slice(-MAX_ENTRIES);
  persist(next);
  const stats = computeStats(next);
  const newMilestoneG =
    stats.lastMilestoneG !== null && stats.lastMilestoneG !== before.lastMilestoneG ? stats.lastMilestoneG : null;
  return { entry: full, stats, newMilestoneG };
}

/** "+53g ≈ 9 eggs" — makes protein numbers tangible (a large egg has ~6g protein). */
export function proteinEquivalent(grams: number): string | null {
  if (!Number.isFinite(grams) || grams < 6) return null;
  const eggs = Math.round(grams / 6);
  return `≈ ${eggs} egg${eggs === 1 ? "" : "s"} worth of protein`;
}
