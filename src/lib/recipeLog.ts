import { isCapacitorNative } from "@/lib/capacitorEnv";

export interface SavedRecipe {
  id: string;
  dishName: string;
  displayName: string;
  mode: string;
  servings: number;
  savedAt: number;
  versions: any[];
  tagline: string;
  source?: "typed" | "youtube" | "tiktok" | "text";
  sliderKey?: string;
}

const STORAGE_KEY = "wisedish_recipe_log";
const LEGACY_STORAGE_KEY = "foodzap_recipe_log";
const MAX_RECIPES = 50;
export const SELECTED_RECIPE_KEY = "wisedish_selected_recipe_id";
const LEGACY_SELECTED_RECIPE_KEY = "foodzap_selected_recipe_id";
export const RECIPE_LOG_EVENT = "wisedish-recipe-log-updated";
const LEGACY_RECIPE_LOG_EVENT = "foodzap-recipe-log-updated";

/** In-memory fallback when both storages are blocked (e.g. strict private mode). */
const memoryStore = new Map<string, string>();

type StorageKind = "local" | "session" | "memory";

let cachedStorageKind: StorageKind | null = null;

/** Native WebView: mirror + Capacitor Preferences (localStorage is unreliable in some shells). */
const nativeMirror: Record<string, string> = {};
let nativeInitPromise: Promise<void> | null = null;

function isNativeRecipeBackend(): boolean {
  return typeof window !== "undefined" && isCapacitorNative();
}

function getStorageKind(): StorageKind {
  if (typeof window === "undefined") return "memory";
  if (cachedStorageKind) return cachedStorageKind;
  try {
    const t = "__fz_recipe_log_test__";
    window.localStorage.setItem(t, "1");
    window.localStorage.removeItem(t);
    cachedStorageKind = "local";
  } catch {
    try {
      const t2 = "__fz_recipe_log_test__";
      window.sessionStorage.setItem(t2, "1");
      window.sessionStorage.removeItem(t2);
      cachedStorageKind = "session";
    } catch {
      cachedStorageKind = "memory";
    }
  }
  return cachedStorageKind;
}

function storageGet(key: string): string | null {
  if (isNativeRecipeBackend()) {
    return nativeMirror[key] ?? null;
  }
  const kind = getStorageKind();
  if (kind === "local") {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStore.get(key) ?? null;
    }
  }
  if (kind === "session") {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return memoryStore.get(key) ?? null;
    }
  }
  return memoryStore.get(key) ?? null;
}

function persistNativeKey(key: string, value: string): void {
  void (async () => {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key, value });
  })();
}

function removeNativeKey(key: string): void {
  void (async () => {
    const { Preferences } = await import("@capacitor/preferences");
    try {
      await Preferences.remove({ key });
    } catch {
      await Preferences.set({ key, value: "" });
    }
  })();
}

function storageSet(key: string, value: string): void {
  if (isNativeRecipeBackend()) {
    nativeMirror[key] = value;
    persistNativeKey(key, value);
    return;
  }
  const kind = getStorageKind();
  if (kind === "local") {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch {
      memoryStore.set(key, value);
      return;
    }
  }
  if (kind === "session") {
    try {
      window.sessionStorage.setItem(key, value);
      return;
    } catch {
      memoryStore.set(key, value);
      return;
    }
  }
  memoryStore.set(key, value);
}

function storageRemove(key: string): void {
  if (isNativeRecipeBackend()) {
    delete nativeMirror[key];
    removeNativeKey(key);
    return;
  }
  try {
    window.localStorage?.removeItem(key);
  } catch {
    /* ignore */
  }
  try {
    window.sessionStorage?.removeItem(key);
  } catch {
    /* ignore */
  }
  memoryStore.delete(key);
}

function notifyRecipeLogUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RECIPE_LOG_EVENT));
  window.dispatchEvent(new Event(LEGACY_RECIPE_LOG_EVENT));
}

function parseRecipes(raw: string | null): SavedRecipe[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === "object") as SavedRecipe[];
  } catch {
    return [];
  }
}

function mergeRecipeLists(a: SavedRecipe[], b: SavedRecipe[]): SavedRecipe[] {
  const byId = new Map<string, SavedRecipe>();
  for (const r of [...a, ...b]) {
    if (r?.id) byId.set(r.id, r);
  }
  return Array.from(byId.values()).sort((x, y) => y.savedAt - x.savedAt).slice(0, MAX_RECIPES);
}

/**
 * Loads recipe log from Capacitor Preferences (and migrates from WebView localStorage once).
 * Call from app shell on startup; also runs automatically on native via queueMicrotask.
 */
export function initRecipeLogNativeStorage(): Promise<void> {
  if (typeof window === "undefined" || !isCapacitorNative()) {
    return Promise.resolve();
  }
  if (nativeInitPromise) return nativeInitPromise;
  nativeInitPromise = (async () => {
    const { Preferences } = await import("@capacitor/preferences");
    let fromPrefs = (await Preferences.get({ key: STORAGE_KEY })).value;
    const legacyPrefs = (await Preferences.get({ key: LEGACY_STORAGE_KEY })).value;
    if (!fromPrefs && legacyPrefs) fromPrefs = legacyPrefs;
    let fromLs: string | null = null;
    try {
      fromLs = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    let merged = mergeRecipeLists(parseRecipes(fromPrefs), parseRecipes(fromLs));
    merged = mergeRecipeLists(merged, parseRecipes(nativeMirror[STORAGE_KEY]));
    const serialized = JSON.stringify(merged);
    nativeMirror[STORAGE_KEY] = serialized;
    await Preferences.set({ key: STORAGE_KEY, value: serialized });

    let selPrefs = (await Preferences.get({ key: SELECTED_RECIPE_KEY })).value;
    const legacySelPrefs = (await Preferences.get({ key: LEGACY_SELECTED_RECIPE_KEY })).value;
    if (!selPrefs && legacySelPrefs) selPrefs = legacySelPrefs;
    let selLs: string | null = null;
    try {
      selLs = window.localStorage.getItem(SELECTED_RECIPE_KEY) ?? window.localStorage.getItem(LEGACY_SELECTED_RECIPE_KEY);
    } catch {
      /* ignore */
    }
    const sel = selPrefs || selLs;
    if (sel) {
      nativeMirror[SELECTED_RECIPE_KEY] = sel;
      await Preferences.set({ key: SELECTED_RECIPE_KEY, value: sel });
    }

    notifyRecipeLogUpdated();
  })().catch(() => {
    nativeInitPromise = null;
  });
  return nativeInitPromise;
}

if (typeof window !== "undefined") {
  queueMicrotask(() => {
    if (isCapacitorNative()) void initRecipeLogNativeStorage();
  });
}

function readRecipes(): SavedRecipe[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = storageGet(STORAGE_KEY) ?? storageGet(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === "object") as SavedRecipe[];
  } catch {
    return [];
  }
}

function writeRecipes(recipes: SavedRecipe[]): void {
  if (typeof window === "undefined") return;
  try {
    storageSet(STORAGE_KEY, JSON.stringify(recipes));
    notifyRecipeLogUpdated();
  } catch {
    // Ignore storage write failures.
  }
}

export function saveRecipe(recipe: SavedRecipe): void {
  const current = readRecipes();
  const filtered = current.filter(
    (r) => !(r.dishName === recipe.dishName && r.mode === recipe.mode && (r.sliderKey ?? "") === (recipe.sliderKey ?? ""))
  );
  const next = [recipe, ...filtered].sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_RECIPES);
  writeRecipes(next);
}

export function getSavedRecipes(): SavedRecipe[] {
  return readRecipes().sort((a, b) => b.savedAt - a.savedAt);
}

export function getSavedRecipe(dishName: string, mode: string, sliderKey: string = ""): SavedRecipe | null {
  const hit = readRecipes().find((r) => r.dishName === dishName && r.mode === mode && (r.sliderKey ?? "") === sliderKey);
  return hit ?? null;
}

/** Latest saved recipe for a dish+mode, regardless of slider profile. */
export function getLatestSavedRecipeByDishMode(dishName: string, mode: string): SavedRecipe | null {
  const normalizedDish = dishName.trim().toLowerCase();
  const hit = readRecipes()
    .filter((r) => r.dishName === normalizedDish && r.mode === mode)
    .sort((a, b) => b.savedAt - a.savedAt)[0];
  return hit ?? null;
}

export function deleteRecipe(id: string): void {
  const filtered = readRecipes().filter((r) => r.id !== id);
  writeRecipes(filtered);
}

export function hasRecipe(dishName: string, mode: string, sliderKey: string = ""): boolean {
  return !!getSavedRecipe(dishName, mode, sliderKey);
}

export function clearAllRecipes(): void {
  writeRecipes([]);
}

export function setSelectedRecipeId(id: string): void {
  try {
    storageSet(SELECTED_RECIPE_KEY, id);
  } catch {
    // Ignore.
  }
}

export function takeSelectedRecipeId(): string | null {
  try {
    const value = storageGet(SELECTED_RECIPE_KEY) ?? storageGet(LEGACY_SELECTED_RECIPE_KEY);
    if (value) {
      storageRemove(SELECTED_RECIPE_KEY);
      storageRemove(LEGACY_SELECTED_RECIPE_KEY);
    }
    return value;
  } catch {
    return null;
  }
}
