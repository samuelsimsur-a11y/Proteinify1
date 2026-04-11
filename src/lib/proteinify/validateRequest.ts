import type { GenerateApiRequestBody, VersionId } from "./apiContract";
import type { IngredientOverride, SliderValues, TransformationMode } from "./types";

function isVersionId(x: unknown): x is VersionId {
  return x === "close-match" || x === "balanced" || x === "max-protein";
}

function isSliderValues(x: unknown): x is SliderValues {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  for (const key of ["tasteIntegrity", "proteinBoost", "pantryRealism"] as const) {
    const v = o[key];
    if (typeof v !== "number" || !Number.isFinite(v)) return false;
    if (!Number.isInteger(v) || v < 0 || v > 10) return false;
  }
  return true;
}

function isTransformationMode(x: unknown): x is TransformationMode {
  return x === "proteinify" || x === "lean";
}

function isIngredientOverride(x: unknown): x is IngredientOverride {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.ingredientId === "string" && typeof o.forceReplacement === "string";
}

function parseOverridesArray(x: unknown): IngredientOverride[] | null {
  if (!Array.isArray(x)) return null;
  const out: IngredientOverride[] = [];
  for (const item of x) {
    if (!isIngredientOverride(item)) return null;
    out.push(item);
  }
  return out;
}

function normalizeOverridesByVersion(
  raw: unknown
): Record<VersionId, IngredientOverride[]> | null {
  if (raw === undefined) {
    return { "close-match": [], balanced: [], "max-protein": [] };
  }
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const cm = o["close-match"];
  const bal = o.balanced;
  const mp = o["max-protein"];
  const a = cm === undefined ? [] : parseOverridesArray(cm);
  const b = bal === undefined ? [] : parseOverridesArray(bal);
  const c = mp === undefined ? [] : parseOverridesArray(mp);
  if (a === null || b === null || c === null) return null;
  return { "close-match": a, balanced: b, "max-protein": c };
}

/**
 * Validates POST /api/generate JSON body (same contract as future real AI).
 */
export function validateGenerateRequestBody(
  body: unknown
): { ok: true; data: GenerateApiRequestBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const o = body as Record<string, unknown>;

  const dishRaw = o.dish;
  if (typeof dishRaw !== "string") {
    return { ok: false, error: "dish must be a string." };
  }
  const dish = dishRaw.trim();
  if (!dish) {
    return { ok: false, error: "dish must not be empty." };
  }

  if (!isSliderValues(o.sliders)) {
    return { ok: false, error: "sliders must include tasteIntegrity, proteinBoost, pantryRealism (integers 0–10)." };
  }

  const obv = normalizeOverridesByVersion(o.overridesByVersion);
  if (!obv) {
    return { ok: false, error: "overridesByVersion must be an object with optional arrays per version." };
  }

  const targetVersion = o.targetVersion;
  if (targetVersion !== undefined && !isVersionId(targetVersion)) {
    return { ok: false, error: "targetVersion must be close-match, balanced, or max-protein." };
  }

  const previousResponse = o.previousResponse;

  const transformationMode = o.transformationMode;
  if (transformationMode !== undefined && !isTransformationMode(transformationMode)) {
    return { ok: false, error: 'transformationMode must be "proteinify" or "lean".' };
  }

  const addVeggies = o.addVeggies;
  if (addVeggies !== undefined && typeof addVeggies !== "boolean") {
    return { ok: false, error: "addVeggies must be a boolean." };
  }

  if (targetVersion !== undefined) {
    if (previousResponse === undefined || previousResponse === null) {
      return { ok: false, error: "previousResponse is required when targetVersion is set." };
    }
  }

  const data: GenerateApiRequestBody = {
    dish,
    sliders: o.sliders as SliderValues,
    overridesByVersion: obv,
    ...(transformationMode !== undefined ? { transformationMode } : {}),
    ...(addVeggies !== undefined ? { addVeggies } : {}),
    ...(targetVersion !== undefined ? { targetVersion } : {}),
    ...(previousResponse !== undefined ? { previousResponse: previousResponse as GenerateApiRequestBody["previousResponse"] } : {}),
  };

  return { ok: true, data };
}
