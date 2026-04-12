export type SliderValues = {
  tasteIntegrity: number; // 0-10
  proteinBoost: number; // 0-10
  pantryRealism: number; // 0-10
};

export type TransformationMode = "proteinify" | "lean";

export type IngredientSwapOptionType =
  | "more-authentic"
  | "higher-protein"
  | "more-common"
  | "cheaper"
  | "dairy-free"
  | "vegetarian"
  | "simpler";

export type IngredientSwapOption = {
  type: IngredientSwapOptionType;
  label: string;
  replacement: string;
  effect: string;
};

export type Ingredient = {
  id: string;
  original: string;
  current: string;
  amount: string;
  reason: string;
  swapOptions: IngredientSwapOption[];
  /** Grams protein per 100 g (typically USDA-backed when estimated is not true). */
  proteinPer100g?: number;
  fatPer100g?: number;
  carbsPer100g?: number;
  caloriesPer100g?: number;
  /** True when USDA had no match or request failed; macro fields may be model-only. */
  estimated?: boolean;
};

export type RecipeStep = string;

/** Per-serving protein estimate (p) and gain vs typical original (d) — compact wire key `macros`. */
export type VersionMacros = {
  p: number;
  d: number;
};

/** Optional chef-style vegetable / add-on notes (wire `adds`, each item uses `note`). */
export type AdditionItem = {
  note: string;
};

/** Component-level transformation copy for the “engine” UI (protein / carbs / broth / fat / toppings). */
export type TransformationByComponent = {
  protein: string[];
  carbBase: string[];
  sauceBroth: string[];
  fat: string[];
  toppings: string[];
};

export type RecipeDifficulty = "Easy" | "Medium" | "Takes effort";

export type RecipeVersion = {
  id: "close-match" | "balanced" | "max-protein";
  label: "Close Match" | "Balanced" | "Full Send" | "Fully Light";
  summary: string;
  /** Estimated total prep + cook minutes for this tier (model-supplied). */
  cookTimeMinutes: number;
  difficulty: RecipeDifficulty;
  macros: VersionMacros;
  totalProteinG?: number;
  swapSummary?: string[];
  mealPrepNote?: string | null;
  proteinMathWarning?: string | null;
  tasteScore: number; // 0-10
  realismScore: number; // 0-10
  aggressivenessScore: number; // 0-10
  why: string;
  adds: AdditionItem[];
  /** Hero layer: what changed per dish component (from model). */
  transformationByComponent: TransformationByComponent;
  /** Short modification-first bullets before full recipe. */
  methodAdjustments: string[];
  ingredients: Ingredient[];
  steps: RecipeStep[];
};

export type ProteinifyResponse = {
  inputDish: string;
  assumptions: string[];
  versions: [RecipeVersion, RecipeVersion, RecipeVersion];
};

export type IngredientOverride = {
  ingredientId: string;
  forceReplacement: string;
};

export type RegenerationRequest = {
  dish: string;
  sliders: SliderValues;
  servings?: 1 | 2 | 4 | 6 | 8;
  overrides: IngredientOverride[];
  targetVersion?: RecipeVersion["id"];
  transformationMode?: TransformationMode;
  /** When true, prompt/mock add vegetable additions across versions (not plant-based conversion). */
  addVeggies?: boolean;
};

