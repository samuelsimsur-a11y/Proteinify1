import type { Ingredient, ProteinifyResponse } from "./types";

/** FDC search returns these per 100 g for Foundation / SR Legacy foods. */
const ID_PROTEIN = 1003;
const ID_FAT = 1004;
const ID_CARBS = 1005;
/** Energy in kcal (not kJ). */
const ID_ENERGY_KCAL = 1008;
const ID_ENERGY_KJ = 1062;

const USDA_FETCH_MS = 12_000;
/** Max concurrent USDA searches (deduped unique ingredient strings first). */
const USDA_CONCURRENCY = 6;

type FoodNutrient = {
  nutrientId?: number;
  value?: number;
  unitName?: string;
};

function normalizeIngredientQuery(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .slice(0, 120);
}

function extractMacrosPer100gFromNutrients(nutrients: FoodNutrient[]): {
  protein: number;
  fat: number;
  carbs: number;
  calories: number;
} | null {
  let protein: number | undefined;
  let fat: number | undefined;
  let carbs: number | undefined;
  let calories: number | undefined;
  let energyKj: number | undefined;

  for (const n of nutrients) {
    const id = n.nutrientId;
    const v = n.value;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;

    if (id === ID_PROTEIN) protein = v;
    else if (id === ID_FAT) fat = v;
    else if (id === ID_CARBS) carbs = v;
    else if (id === ID_ENERGY_KCAL && (n.unitName === "KCAL" || n.unitName === "kcal")) calories = v;
    else if (id === ID_ENERGY_KJ && (n.unitName === "kJ" || n.unitName === "KJ")) energyKj = v;
  }

  if (calories === undefined && energyKj !== undefined) {
    calories = energyKj / 4.184;
  }

  if (
    protein === undefined ||
    fat === undefined ||
    carbs === undefined ||
    calories === undefined
  ) {
    return null;
  }

  return { protein, fat, carbs, calories };
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Search FDC; first hit only. Returns per-100g macros or null if nothing usable.
 */
export async function fetchUsdaMacrosForIngredient(
  ingredientQuery: string,
  apiKey: string
): Promise<{ protein: number; fat: number; carbs: number; calories: number } | null> {
  const q = ingredientQuery.trim().slice(0, 120);
  if (!q) return null;

  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("query", q);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("pageSize", "1");
  url.searchParams.append("dataType", "SR Legacy");
  url.searchParams.append("dataType", "Foundation");

  let res: Response;
  try {
    res = await fetchWithTimeout(url.toString(), USDA_FETCH_MS);
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const data = (await res.json()) as {
    foods?: Array<{ foodNutrients?: FoodNutrient[] }>;
  };
  const food = data.foods?.[0];
  const nutrients = food?.foodNutrients;
  if (!nutrients?.length) return null;

  return extractMacrosPer100gFromNutrients(nutrients);
}

async function poolMap<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (true) {
      const i = index++;
      if (i >= items.length) return;
      results[i] = await mapper(items[i]);
    }
  }

  const n = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

function applyMacrosToIngredient(
  ing: Ingredient,
  macros: { protein: number; fat: number; carbs: number; calories: number } | null
): Ingredient {
  if (!macros) {
    return { ...ing, estimated: true };
  }
  return {
    ...ing,
    proteinPer100g: macros.protein,
    fatPer100g: macros.fat,
    carbsPer100g: macros.carbs,
    caloriesPer100g: macros.calories,
    estimated: false,
  };
}

/**
 * Dedupes ingredient strings, limits parallel USDA calls, times out slow requests.
 */
export async function enrichProteinifyResponseWithUsda(
  data: ProteinifyResponse,
  usdaApiKey: string
): Promise<ProteinifyResponse> {
  const key = usdaApiKey.trim();
  if (!key) return data;

  type Pos = { vi: number; ii: number };
  const flat: { pos: Pos; ing: Ingredient }[] = [];
  data.versions.forEach((v, vi) => {
    v.ingredients.forEach((ing, ii) => flat.push({ pos: { vi, ii }, ing }));
  });

  const queryKeyByIndex = flat.map(({ ing }) => normalizeIngredientQuery(ing.current));
  const uniqueQueries = [...new Set(queryKeyByIndex.filter((q) => q.length > 0))];

  const macroList = await poolMap(uniqueQueries, USDA_CONCURRENCY, async (q) => {
    try {
      return await fetchUsdaMacrosForIngredient(q, key);
    } catch {
      return null;
    }
  });

  const macroByQuery = new Map<string, typeof macroList[0]>();
  uniqueQueries.forEach((q, i) => macroByQuery.set(q, macroList[i]));

  const enrichedList = flat.map(({ ing }, idx) => {
    const q = queryKeyByIndex[idx];
    if (!q) return { ...ing, estimated: true };
    const macros = macroByQuery.get(q) ?? null;
    return applyMacrosToIngredient(ing, macros);
  });

  const versions = data.versions.map((v) => ({
    ...v,
    ingredients: [...v.ingredients],
  }));

  flat.forEach(({ pos }, idx) => {
    versions[pos.vi].ingredients[pos.ii] = enrichedList[idx];
  });

  return { ...data, versions: versions as ProteinifyResponse["versions"] };
}
