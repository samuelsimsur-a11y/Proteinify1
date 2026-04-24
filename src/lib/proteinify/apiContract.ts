import type { IngredientOverride, ProteinifyResponse, SliderValues, TransformationMode } from "./types";

export type VersionId = "close-match" | "balanced" | "max-protein";

export type ImportedRecipeContext = {
  ingredients: string[];
  instructions: string[];
  source?: "youtube" | "tiktok";
  originalTitle?: string;
  confidence?: "high" | "medium" | "low";
};

/** POST /api/generate — same shape we’ll use for the real AI later */
export type GenerateApiRequestBody = {
  dish: string;
  sliders: SliderValues;
  /** Fast pass: prioritize a high-quality Close Match first. */
  quickCloseMatch?: boolean;
  servings?: 1 | 2 | 4 | 6 | 8;
  /**
   * Transformation mode selected by the user (verb buttons).
   * Defaults to "proteinify" in the backend when omitted.
   */
  transformationMode?: TransformationMode;
  /**
   * When true, add chefly vegetable additions across versions (API prompt / mock), not a plant-based conversion.
   */
  addVeggies?: boolean;
  /**
   * Per-version ingredient overrides. Omitted keys treated as empty arrays.
   * For full runs, typically all empty or populated after swaps.
   */
  overridesByVersion?: Partial<Record<VersionId, IngredientOverride[]>>;
  /**
   * If set, only this version is recomputed; others are taken from previousResponse.
   * Requires previousResponse when set.
   */
  targetVersion?: VersionId;
  /**
   * Full previous payload — required when targetVersion is set so non-target versions stay unchanged.
   */
  previousResponse?: ProteinifyResponse;
  /**
   * Recipe details imported from external URL (YouTube/TikTok).
   * When present, generation should use this as the baseline context.
   */
  importedRecipe?: ImportedRecipeContext;
};

export type GenerateApiErrorBody = {
  error: string;
  code?:
    | "VALIDATION"
    | "MERGE"
    | "INTERNAL"
    | "AI_CONFIG"
    | "AI_REQUEST"
    | "AI_JSON"
    | "AI_SCHEMA";
  details?: unknown;
};
