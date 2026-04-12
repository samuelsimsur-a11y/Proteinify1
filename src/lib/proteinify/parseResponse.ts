import type {
  AdditionItem,
  Ingredient,
  IngredientSwapOption,
  ProteinifyResponse,
  RecipeDifficulty,
  RecipeVersion,
  TransformationByComponent,
} from "./types";

const DIFFICULTY_VALUES = new Set<RecipeDifficulty>(["Easy", "Medium", "Takes effort"]);

function parseCookTimeMinutesField(raw: unknown): number {
  if (!isNumber(raw) || !Number.isFinite(raw)) return 35;
  return Math.max(5, Math.min(720, Math.round(raw)));
}

function parseDifficultyField(raw: unknown): RecipeDifficulty {
  if (!isString(raw) || !DIFFICULTY_VALUES.has(raw as RecipeDifficulty)) return "Medium";
  return raw as RecipeDifficulty;
}

const EMPTY_TRANSFORMATION: TransformationByComponent = {
  protein: [],
  carbBase: [],
  sauceBroth: [],
  fat: [],
  toppings: [],
};

function parseTransformationByComponent(raw: unknown): TransformationByComponent | null {
  if (!isRecord(raw)) return null;
  const keys = ["protein", "carbBase", "sauceBroth", "fat", "toppings"] as const;
  const out: TransformationByComponent = { ...EMPTY_TRANSFORMATION };
  for (const k of keys) {
    const a = raw[k];
    if (!Array.isArray(a) || a.length > 6) return null;
    if (!a.every((x) => isString(x))) return null;
    out[k] = a as string[];
  }
  return out;
}

function parseMethodAdjustments(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length < 2 || raw.length > 12) return null;
  if (!raw.every((x) => isString(x))) return null;
  return raw as string[];
}

function fallbackTransformationFromSwapSummary(swapSummary: string[] | undefined): TransformationByComponent {
  const pills = swapSummary?.filter(Boolean) ?? [];
  if (pills.length === 0) return { ...EMPTY_TRANSFORMATION };
  return {
    protein: pills.slice(0, 2),
    carbBase: pills.length > 2 ? pills.slice(2, 3) : [],
    sauceBroth: pills.length > 3 ? pills.slice(3, 4) : [],
    fat: pills.length > 4 ? pills.slice(4, 5) : [],
    toppings: pills.length > 5 ? pills.slice(5, 6) : [],
  };
}

function fallbackMethodAdjustments(steps: string[]): string[] {
  if (steps.length >= 2) return steps.slice(0, Math.min(6, steps.length));
  if (steps.length === 1) return [steps[0]!, "Taste and adjust salt before serving."];
  return ["Apply the ingredient changes for this tier.", "Follow your usual cook flow for the rest of the dish."];
}

const VERSION_IDS = new Set<RecipeVersion["id"]>(["close-match", "balanced", "max-protein"]);

function isValidRecipeLabel(id: RecipeVersion["id"], label: string): label is RecipeVersion["label"] {
  if (id === "close-match") return label === "Close Match";
  if (id === "balanced") return label === "Balanced";
  return label === "Full Send" || label === "Fully Light";
}

const SWAP_TYPES = new Set([
  "more-authentic",
  "higher-protein",
  "more-common",
  "cheaper",
  "dairy-free",
  "vegetarian",
  "simpler",
]);

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isString(x: unknown): x is string {
  return typeof x === "string";
}

function isNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function parseOptionalNonnegNumber(raw: Record<string, unknown>, key: string): number | undefined {
  const v = raw[key];
  if (v === undefined) return undefined;
  if (!isNumber(v) || v < 0) return undefined;
  return v;
}

function parseIngredientSwapOption(raw: unknown): IngredientSwapOption | null {
  if (!isRecord(raw)) return null;
  const type = raw.type;
  const label = raw.label;
  const replacement = raw.replacement;
  const effect = raw.effect;
  if (!isString(type) || !SWAP_TYPES.has(type as IngredientSwapOption["type"])) return null;
  if (!isString(label) || !isString(replacement) || !isString(effect)) return null;
  return { type: type as IngredientSwapOption["type"], label, replacement, effect };
}

function parseIngredient(raw: unknown): Ingredient | null {
  if (!isRecord(raw)) return null;
  const id = raw.id;
  const original = raw.original;
  const current = raw.current;
  const amount = raw.amount;
  const reason = raw.reason;
  const swapOptions = raw.swapOptions;
  if (!isString(id) || !isString(original) || !isString(current) || !isString(amount) || !isString(reason))
    return null;
  if (!Array.isArray(swapOptions)) return null;
  const opts: IngredientSwapOption[] = [];
  for (const o of swapOptions) {
    const p = parseIngredientSwapOption(o);
    if (!p) return null;
    opts.push(p);
  }
  if (opts.length < 2 || opts.length > 4) return null;

  const proteinPer100g = parseOptionalNonnegNumber(raw, "proteinPer100g");
  const fatPer100g = parseOptionalNonnegNumber(raw, "fatPer100g");
  const carbsPer100g = parseOptionalNonnegNumber(raw, "carbsPer100g");
  const caloriesPer100g = parseOptionalNonnegNumber(raw, "caloriesPer100g");

  return {
    id,
    original,
    current,
    amount,
    reason,
    swapOptions: opts,
    ...(proteinPer100g !== undefined ? { proteinPer100g } : {}),
    ...(fatPer100g !== undefined ? { fatPer100g } : {}),
    ...(carbsPer100g !== undefined ? { carbsPer100g } : {}),
    ...(caloriesPer100g !== undefined ? { caloriesPer100g } : {}),
  };
}

function parseAdditionItem(raw: unknown): AdditionItem | null {
  if (!isRecord(raw)) return null;
  const note = raw.note;
  if (!isString(note)) return null;
  return { note };
}

export function parseRecipeVersion(raw: unknown): RecipeVersion | null {
  if (!isRecord(raw)) return null;
  const id = raw.id;
  const label = raw.label;
  const summary = raw.summary;
  const macrosRaw = raw.macros;
  const totalProteinGRaw = raw.totalProteinG;
  const swapSummaryRaw = raw.swapSummary;
  const mealPrepNoteRaw = raw.mealPrepNote;
  const proteinMathWarningRaw = raw.proteinMathWarning;
  const tasteScore = raw.tasteScore;
  const realismScore = raw.realismScore;
  const aggressivenessScore = raw.aggressivenessScore;
  const why = raw.why;
  const addsRaw = raw.adds;
  const ingredients = raw.ingredients;
  const steps = raw.steps;

  if (!isString(id) || !VERSION_IDS.has(id as RecipeVersion["id"])) return null;
  if (!isString(label) || !isValidRecipeLabel(id as RecipeVersion["id"], label)) return null;
  if (!isString(summary) || !isString(why)) return null;
  if (!isRecord(macrosRaw)) return null;
  const p = macrosRaw.p;
  const d = macrosRaw.d;
  if (!isNumber(p) || p < 0) return null;
  if (!isNumber(d) || d < 0) return null;
  if (
    !isNumber(tasteScore) ||
    !isNumber(realismScore) ||
    !isNumber(aggressivenessScore) ||
    tasteScore < 0 ||
    tasteScore > 10 ||
    realismScore < 0 ||
    realismScore > 10 ||
    aggressivenessScore < 0 ||
    aggressivenessScore > 10
  ) {
    return null;
  }
  if (!Array.isArray(ingredients) || !Array.isArray(steps)) return null;

  let totalProteinG: number | undefined;
  if (totalProteinGRaw !== undefined) {
    if (!isNumber(totalProteinGRaw) || totalProteinGRaw < 0) return null;
    totalProteinG = totalProteinGRaw;
  }

  let swapSummary: string[] | undefined;
  if (swapSummaryRaw !== undefined) {
    if (!Array.isArray(swapSummaryRaw) || swapSummaryRaw.length > 4) return null;
    if (!swapSummaryRaw.every((s) => isString(s))) return null;
    swapSummary = swapSummaryRaw as string[];
  }

  let mealPrepNote: string | null | undefined;
  if (mealPrepNoteRaw !== undefined) {
    if (!(mealPrepNoteRaw === null || isString(mealPrepNoteRaw))) return null;
    mealPrepNote = mealPrepNoteRaw as string | null;
  }

  let proteinMathWarning: string | null | undefined;
  if (proteinMathWarningRaw !== undefined) {
    if (!(proteinMathWarningRaw === null || isString(proteinMathWarningRaw))) return null;
    proteinMathWarning = proteinMathWarningRaw as string | null;
  }

  let adds: AdditionItem[] = [];
  if (addsRaw === undefined) {
    adds = [];
  } else if (!Array.isArray(addsRaw) || addsRaw.length > 3) {
    return null;
  } else {
    for (const a of addsRaw) {
      const pi = parseAdditionItem(a);
      if (!pi) return null;
      adds.push(pi);
    }
  }

  const ingList: Ingredient[] = [];
  for (const ing of ingredients) {
    const ingParsed = parseIngredient(ing);
    if (!ingParsed) return null;
    ingList.push(ingParsed);
  }
  const stepList: string[] = [];
  for (const s of steps) {
    if (!isString(s)) return null;
    stepList.push(s);
  }

  const tbcParsed = parseTransformationByComponent(raw.transformationByComponent);
  const methodParsed = parseMethodAdjustments(raw.methodAdjustments);
  const transformationByComponent =
    tbcParsed ?? fallbackTransformationFromSwapSummary(swapSummary);
  const methodAdjustments = methodParsed ?? fallbackMethodAdjustments(stepList);

  const cookTimeMinutes = parseCookTimeMinutesField(raw.cookTimeMinutes);
  const difficulty = parseDifficultyField(raw.difficulty);

  return {
    id: id as RecipeVersion["id"],
    label: label as RecipeVersion["label"],
    summary,
    cookTimeMinutes,
    difficulty,
    macros: { p, d },
    ...(totalProteinG !== undefined ? { totalProteinG } : {}),
    ...(swapSummary !== undefined ? { swapSummary } : {}),
    ...(mealPrepNote !== undefined ? { mealPrepNote } : {}),
    ...(proteinMathWarning !== undefined ? { proteinMathWarning } : {}),
    tasteScore,
    realismScore,
    aggressivenessScore,
    why,
    adds,
    transformationByComponent,
    methodAdjustments,
    ingredients: ingList,
    steps: stepList,
  };
}

export type ParseResult =
  | { ok: true; data: ProteinifyResponse }
  | { ok: false; error: string };

/**
 * Validates the wire JSON matches the strict Proteinify contract (shape + version ids/labels).
 */

/**
 * Strip optional ```json fences and parse. Used after OpenAI returns a JSON string (may include stray whitespace).
 */
export function parseModelJsonOutput(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  let t = text.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/im.exec(t);
  if (fence) t = fence[1]?.trim() ?? t;
  try {
    return { ok: true, value: JSON.parse(t) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Model output was not valid JSON after parsing.";
    return { ok: false, error: msg };
  }
}

/**
 * Validates the partial payload for single-version AI regeneration, then merges into the previous full response.
 */
export function parseSingleVersionAiJson(
  json: unknown,
  targetVersion: RecipeVersion["id"],
  previous: ProteinifyResponse
): ParseResult {
  if (!isRecord(json)) return { ok: false, error: "AI single-version payload is not a JSON object." };

  const versionRaw = json.version;
  const v = parseRecipeVersion(versionRaw);
  if (!v) return { ok: false, error: "AI payload.version is not a valid recipe version." };
  if (v.id !== targetVersion) {
    return { ok: false, error: `AI payload.version.id must be "${targetVersion}", got "${v.id}".` };
  }

  const inputDish = json.inputDish;
  const assumptions = json.assumptions;

  const dishOut = isString(inputDish) ? inputDish : previous.inputDish;
  let assumptionsOut: string[];
  if (Array.isArray(assumptions) && assumptions.every((x) => isString(x))) {
    assumptionsOut = assumptions as string[];
  } else {
    assumptionsOut = previous.assumptions;
  }

  const idx = targetVersion === "close-match" ? 0 : targetVersion === "balanced" ? 1 : 2;
  const data: ProteinifyResponse = {
    inputDish: dishOut,
    assumptions: assumptionsOut,
    versions: [
      idx === 0 ? v : previous.versions[0],
      idx === 1 ? v : previous.versions[1],
      idx === 2 ? v : previous.versions[2],
    ],
  };

  return { ok: true, data };
}

export function parseProteinifyResponseJson(json: unknown): ParseResult {
  if (!isRecord(json)) return { ok: false, error: "Response is not a JSON object." };

  const inputDish = isString(json.inputDish)
    ? json.inputDish
    : isString(json.dish)
      ? json.dish
      : null;

  const assumptions = Array.isArray(json.assumptions)
    ? json.assumptions
    : isString(json.tagline)
      ? [json.tagline]
      : [];

  const rawVersions = json.versions;

  if (!isString(inputDish)) return { ok: false, error: "Missing or invalid inputDish." };
  if (!Array.isArray(assumptions)) return { ok: false, error: "Missing or invalid assumptions." };
  for (const a of assumptions) {
    if (!isString(a)) return { ok: false, error: "Invalid assumptions entry." };
  }
  if (!Array.isArray(rawVersions) || rawVersions.length !== 3) {
    return { ok: false, error: "versions must be an array of length 3." };
  }

  // Accept both legacy wire shape and the newer /api/generate v2 shape.
  const normalizeVersion = (raw: unknown, idx: number): unknown => {
    if (!isRecord(raw)) return raw;
    if ("steps" in raw && "macros" in raw) return raw;

    const id: RecipeVersion["id"] = idx === 0 ? "close-match" : idx === 1 ? "balanced" : "max-protein";
    const defaultLabel: RecipeVersion["label"] =
      idx === 0 ? "Close Match" : idx === 1 ? "Balanced" : "Full Send";

    const name = raw.name;
    const summary = raw.summary;
    const originalProteinG = raw.originalProteinG;
    const proteinDeltaG = raw.proteinDeltaG;
    const totalProteinG = raw.totalProteinG;
    const why = raw.summary;
    const swapSummary = raw.swapSummary;
    const mealPrepNote = raw.mealPrepNote;
    const proteinMathWarning = raw.proteinMathWarning;

    const ingredientsRaw = raw.ingredients;
    const instructionsRaw = raw.instructions;
    const ingredients: unknown[] = Array.isArray(ingredientsRaw) ? ingredientsRaw : [];
    const instructions: unknown[] = Array.isArray(instructionsRaw) ? instructionsRaw : [];

    const stepsBuilt = instructions.map((stepObj) => {
      if (!isRecord(stepObj)) return "";
      const step = stepObj.step;
      const heatGuard = stepObj.heatGuard;
      const textureNote = stepObj.textureNote;
      if (!isString(step)) return "";
      const details = [
        isString(heatGuard) ? heatGuard : null,
        isString(textureNote) ? textureNote : null,
      ].filter(Boolean) as string[];
      if (details.length === 0) return step;
      return `${step} ${details.join(" ")}`.trim();
    });

    const tbcWire = raw.transformationByComponent;
    const maWire = raw.methodAdjustments;
    const tbcParsed = parseTransformationByComponent(tbcWire);
    const maParsed = parseMethodAdjustments(maWire);
    const swapArr = Array.isArray(swapSummary) && swapSummary.every(isString) ? (swapSummary as string[]) : undefined;
    const transformationByComponent = tbcParsed ?? fallbackTransformationFromSwapSummary(swapArr);
    const methodAdjustments = maParsed ?? fallbackMethodAdjustments(stepsBuilt.filter(Boolean));

    const cookTimeMinutes = parseCookTimeMinutesField(raw.cookTimeMinutes);
    const difficulty = parseDifficultyField(raw.difficulty);

    return {
      id,
      label: isString(name) &&
        (name === "Close Match" || name === "Balanced" || name === "Full Send" || name === "Fully Light")
        ? name
        : defaultLabel,
      summary: isString(summary) ? summary : "",
      cookTimeMinutes,
      difficulty,
      macros: {
        p: isNumber(totalProteinG)
          ? totalProteinG
          : (isNumber(originalProteinG) ? originalProteinG : 0) + (isNumber(proteinDeltaG) ? proteinDeltaG : 0),
        d: isNumber(proteinDeltaG) ? proteinDeltaG : 0,
      },
      // Keep UI scores stable with sensible defaults when route uses v2 schema.
      tasteScore: 8,
      realismScore: 8,
      aggressivenessScore: idx === 0 ? 4 : idx === 1 ? 7 : 9,
      why: isString(why) ? why : "",
      adds: [],
      transformationByComponent,
      methodAdjustments,
      ...(Array.isArray(swapSummary) ? { swapSummary } : {}),
      ...(mealPrepNote === null || isString(mealPrepNote) ? { mealPrepNote } : {}),
      ...(proteinMathWarning === null || isString(proteinMathWarning) ? { proteinMathWarning } : {}),
      ingredients: ingredients.map((ing, i) => {
        if (!isRecord(ing)) return ing;
        const nameVal = ing.name;
        const amountVal = ing.amount;
        const noteVal = ing.note;
        return {
          id: `ing-${idx + 1}-${i + 1}`,
          original: isString(nameVal) ? nameVal : "ingredient",
          current: isString(nameVal) ? nameVal : "ingredient",
          amount: isString(amountVal) ? amountVal : "",
          reason: isString(noteVal) ? noteVal : "",
          swapOptions: [
            {
              type: "higher-protein",
              label: "Higher protein option",
              replacement: isString(nameVal) ? `${nameVal} (higher protein)` : "higher protein option",
              effect: "Increases protein density",
            },
            {
              type: "more-authentic",
              label: "More authentic option",
              replacement: isString(nameVal) ? nameVal : "original ingredient",
              effect: "Preserves dish identity",
            },
          ],
          ...(isNumber(ing.proteinContributionG) ? { proteinPer100g: ing.proteinContributionG } : {}),
        };
      }),
      steps: stepsBuilt,
    };
  };

  const versions = rawVersions.map((v, idx) => normalizeVersion(v, idx));

  const v0 = parseRecipeVersion(versions[0]);
  const v1 = parseRecipeVersion(versions[1]);
  const v2 = parseRecipeVersion(versions[2]);
  if (!v0 || v0.id !== "close-match") return { ok: false, error: "versions[0] must be Close Match." };
  if (!v1 || v1.id !== "balanced") return { ok: false, error: "versions[1] must be Balanced." };
  if (!v2 || v2.id !== "max-protein") return { ok: false, error: "versions[2] must be Full Send or Fully Light (id max-protein)." };

  const data: ProteinifyResponse = {
    inputDish,
    assumptions,
    versions: [v0, v1, v2],
  };

  return { ok: true, data };
}
