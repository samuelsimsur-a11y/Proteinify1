// src/app/api/generate/route.ts
// v2 — adds servings multiplier, passes to system prompt,
// validates protein math delta vs ingredients, DIL wired.

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { checkGenerateRateLimit, getClientIp } from "@/lib/rateLimit/generateRouteRateLimit";
import { getDishByIdOrAlias, validateDILIntegrity } from "@/lib/culinary/dil/loader";
import { getProteinifySchema } from "@/lib/culinary/dil/loadProteinifySchema";
import { validateSwap } from "@/lib/culinary/dil/validator";
import { buildSystemPrompt, type Mode } from "@/lib/culinary/systemPrompt";
import type { SwapInput, UserGoal, ValidationResult } from "@/lib/culinary/dil/schemas";

// ─── Integrity check once at cold start ──────────────────────────────────────
let integrityChecked = false;
function ensureIntegrity() {
  if (!integrityChecked) {
    validateDILIntegrity();
    integrityChecked = true;
  }
}

let openaiClient: OpenAI | undefined;

function getOpenAI(): OpenAI {
  try {
    if (!openaiClient) {
      openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openaiClient;
  } catch (err) {
    console.error("[generate] OpenAI init failed:", err);
    throw err;
  }
}

// ─── Performance: short-lived response cache ─────────────────────────────────
// Speeds up repeated prompts (same dish + mode + servings + sliders + goal)
// without reducing quality or changing model behavior.
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 120;
const CACHE_SCHEMA_VERSION = "v2.8-transformation-map-wire";
const responseCache = new Map<string, { expiresAt: number; value: GenerateResponse }>();
const inflightRequests = new Map<string, Promise<GenerateResponse>>();
// sharedRecipe + 3 tiers still needs headroom; truncation yields invalid JSON and 502s.
const MAX_COMPLETION_TOKENS = 14000;

/**
 * Extract the first complete top-level JSON object by brace depth (string-aware).
 * `slice(first, lastIndexOf("}"))` is unsafe when "}" appears inside string values.
 */
function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseModelJson(raw: string, logContext?: { finishReason?: string | null }): unknown {
  const trimmed = raw.trim();

  const tryParse = (s: string, label: string): unknown | null => {
    try {
      return JSON.parse(s);
    } catch (e) {
      console.warn(`[generate] JSON.parse failed (${label}):`, e instanceof Error ? e.message : e);
      return null;
    }
  };

  let parsed = tryParse(trimmed, "full");
  if (parsed !== null) return parsed;

  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/im.exec(trimmed);
  if (fence?.[1]) {
    parsed = tryParse(fence[1].trim(), "fence");
    if (parsed !== null) return parsed;
  }

  const balanced = extractFirstJsonObject(trimmed);
  if (balanced) {
    parsed = tryParse(balanced, "balanced");
    if (parsed !== null) return parsed;
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    parsed = tryParse(trimmed.slice(first, last + 1), "first-to-last-brace");
    if (parsed !== null) return parsed;
  }

  const tail = trimmed.slice(Math.max(0, trimmed.length - 400));
  console.error(
    `[generate] JSON parse failed; finish_reason=${logContext?.finishReason ?? "unknown"} len=${trimmed.length} tail=${JSON.stringify(tail)}`
  );
  console.error("[generate] head:", trimmed.slice(0, 400));
  const truncated = logContext?.finishReason === "length";
  throw new Error(
    truncated
      ? "Failed to parse model output: response was truncated. Try again or simplify the dish."
      : "Failed to parse model output."
  );
}

function bucketSlider(v: number | undefined): number | null {
  if (v === undefined || !Number.isFinite(v)) return null;
  return Math.round(v / 10) * 10;
}

function buildCacheKey(input: {
  dish: string;
  mode: Mode;
  servings: number;
  userGoal?: UserGoal;
  sliders?: GenerateRequest["sliders"];
}): string {
  const sliderPart = JSON.stringify({
    // Bucket sliders to improve cache reuse for near-identical requests.
    // This acts like a lightweight "data pool" for similar prompts.
    f: bucketSlider(input.sliders?.flavorPreservation),
    p: bucketSlider(input.sliders?.proteinAggression),
    i: bucketSlider(input.sliders?.ingredientRealism),
  });
  return JSON.stringify({
    v: CACHE_SCHEMA_VERSION,
    dish: input.dish.trim().toLowerCase(),
    mode: input.mode,
    servings: input.servings,
    goal: input.userGoal ?? null,
    sliders: sliderPart,
  });
}

function getCachedResponse(key: string): GenerateResponse | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedResponse(key: string, value: GenerateResponse): void {
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = responseCache.keys().next().value;
    if (firstKey) responseCache.delete(firstKey);
  }
  responseCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

// ─── Request shape ────────────────────────────────────────────────────────────
interface GenerateRequest {
  dish: string;
  mode?: Mode;
  transformationMode?: Mode;
  servings?: number;        // NEW — default 1, max 12
  userGoal?: UserGoal;
  sliders?: {
    flavorPreservation?: number;
    proteinAggression?: number;
    ingredientRealism?: number;
  };
}

// ─── Response shape ───────────────────────────────────────────────────────────
export type TransformationByComponentWire = {
  protein: string[];
  carbBase: string[];
  sauceBroth: string[];
  fat: string[];
  toppings: string[];
};

export interface VersionResult {
  name: "Close Match" | "Balanced" | "Full Send";
  summary: string;
  proteinDeltaG: number;
  originalProteinG: number;
  totalProteinG: number;
  appliedSwapCodes: string[];
  swapSummary: string[];
  transformationByComponent: TransformationByComponentWire;
  methodAdjustments: string[];
  ingredients: Array<{
    name: string;
    amount: string;
    proteinContributionG: number;
    note: string;
  }>;
  instructions: Array<{
    step: string;
    heatGuard: string | null;
    textureNote: string | null;
  }>;
  mealPrepNote: string | null;
  dilValidation: ValidationResult | null;
  proteinMathWarning: string | null;   // surfaces when delta looks implausible
}

export interface GenerateResponse {
  dish: string;
  tagline: string;
  dilDishId: string | null;
  dilRecognised: boolean;
  servings: number;
  versions: VersionResult[];
}

// ─── Shared recipe + tier merge (token-efficient vs 3× full recipes) ─────────
type RecipeIngredientRow = {
  name: string;
  amount: string;
  proteinContributionG: number;
  note: string;
};

type RecipeInstructionRow = {
  step: string;
  heatGuard: string | null;
  textureNote: string | null;
};

type TierIngredientChange = {
  action: "add" | "replace";
  targetSubstring: string | null;
  name: string;
  amount: string;
  proteinContributionG: number;
  note: string;
};

type TierPayload = {
  name: "Close Match" | "Balanced" | "Full Send";
  summary: string;
  proteinDeltaG: number;
  totalProteinG: number;
  appliedSwapCodes: string[];
  swapSummary: string[];
  transformationByComponent: TransformationByComponentWire;
  methodAdjustments: string[];
  ingredientChanges: TierIngredientChange[];
  instructionChanges: RecipeInstructionRow[];
  mealPrepNote: string | null;
};

type SharedRecipePayload = {
  originalProteinG: number;
  ingredients: RecipeIngredientRow[];
  instructions: RecipeInstructionRow[];
};

const EMPTY_COMPONENT_MAP: TransformationByComponentWire = {
  protein: [],
  carbBase: [],
  sauceBroth: [],
  fat: [],
  toppings: [],
};

function mergeSharedWithTier(
  shared: SharedRecipePayload,
  tier: TierPayload
): Omit<VersionResult, "dilValidation" | "proteinMathWarning"> {
  const ingredients = shared.ingredients.map((r) => ({ ...r }));
  for (const ch of tier.ingredientChanges) {
    if (ch.action === "add") {
      ingredients.push({
        name: ch.name,
        amount: ch.amount,
        proteinContributionG: ch.proteinContributionG,
        note: ch.note,
      });
    } else if (ch.action === "replace" && ch.targetSubstring) {
      const t = ch.targetSubstring.toLowerCase();
      const idx = ingredients.findIndex((r) => r.name.toLowerCase().includes(t));
      if (idx >= 0) {
        ingredients[idx] = {
          name: ch.name,
          amount: ch.amount,
          proteinContributionG: ch.proteinContributionG,
          note: ch.note,
        };
      } else {
        ingredients.push({
          name: ch.name,
          amount: ch.amount,
          proteinContributionG: ch.proteinContributionG,
          note: ch.note,
        });
      }
    }
  }

  const instructions = [
    ...shared.instructions.map((s) => ({ ...s })),
    ...tier.instructionChanges.map((s) => ({ ...s })),
  ];

  const tbc =
    tier.transformationByComponent &&
    typeof tier.transformationByComponent === "object" &&
    Array.isArray(tier.transformationByComponent.protein)
      ? tier.transformationByComponent
      : EMPTY_COMPONENT_MAP;
  const methodAdj =
    Array.isArray(tier.methodAdjustments) && tier.methodAdjustments.length >= 2
      ? tier.methodAdjustments
      : [
          "Apply this tier’s ingredient swaps while following the baseline method.",
          "Add heat-sensitive protein boosts off the burner unless the step says otherwise.",
        ];

  return {
    name: tier.name,
    summary: tier.summary,
    proteinDeltaG: tier.proteinDeltaG,
    originalProteinG: shared.originalProteinG,
    totalProteinG: tier.totalProteinG,
    appliedSwapCodes: tier.appliedSwapCodes,
    swapSummary: tier.swapSummary,
    transformationByComponent: tbc,
    methodAdjustments: methodAdj,
    ingredients,
    instructions,
    mealPrepNote: tier.mealPrepNote,
  };
}

function isTierPayload(v: Record<string, unknown>): v is TierPayload {
  return (
    Array.isArray(v.ingredientChanges) &&
    Array.isArray(v.instructionChanges) &&
    !Array.isArray(v.ingredients)
  );
}

function isLegacyTierPayload(v: Record<string, unknown>): boolean {
  return Array.isArray(v.ingredients) && Array.isArray(v.instructions);
}

function expandParsedToMergedVersions(parsedObj: Record<string, unknown>): Omit<
  VersionResult,
  "dilValidation" | "proteinMathWarning"
>[] {
  const versionsRaw = parsedObj.versions;
  if (!Array.isArray(versionsRaw) || versionsRaw.length !== 3) {
    throw new Error("Invalid or missing versions array (need length 3).");
  }

  const sharedRaw = parsedObj.sharedRecipe;
  if (sharedRaw && typeof sharedRaw === "object" && !Array.isArray(sharedRaw)) {
    const sr = sharedRaw as SharedRecipePayload;
    return versionsRaw.map((v, i) => {
      if (!v || typeof v !== "object" || Array.isArray(v)) {
        throw new Error(`Invalid version at index ${i}.`);
      }
      const rec = v as Record<string, unknown>;
      if (!isTierPayload(rec)) {
        throw new Error(`Version ${i} must include ingredientChanges and instructionChanges when using sharedRecipe.`);
      }
      return mergeSharedWithTier(sr, rec);
    });
  }

  return versionsRaw.map((v, i) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      throw new Error(`Invalid version at index ${i}.`);
    }
    const rec = v as Record<string, unknown>;
    if (!isLegacyTierPayload(rec)) {
      throw new Error(`Legacy version ${i} missing ingredients/instructions.`);
    }
    const emptyMap: TransformationByComponentWire = {
      protein: [],
      carbBase: [],
      sauceBroth: [],
      fat: [],
      toppings: [],
    };
    return {
      name: rec.name as TierPayload["name"],
      summary: rec.summary as string,
      proteinDeltaG: rec.proteinDeltaG as number,
      originalProteinG: rec.originalProteinG as number,
      totalProteinG: rec.totalProteinG as number,
      appliedSwapCodes: rec.appliedSwapCodes as string[],
      swapSummary: rec.swapSummary as string[],
      transformationByComponent: emptyMap,
      methodAdjustments: [],
      ingredients: rec.ingredients as RecipeIngredientRow[],
      instructions: rec.instructions as RecipeInstructionRow[],
      mealPrepNote: rec.mealPrepNote as string | null,
    };
  });
}

// ─── Protein math sanity check ────────────────────────────────────────────────
function checkProteinMath(version: {
  proteinDeltaG: number;
  originalProteinG: number;
  totalProteinG: number;
  ingredients: Array<{ proteinContributionG: number }>;
}): string | null {
  const sumFromIngredients = version.ingredients.reduce(
    (sum, i) => sum + (i.proteinContributionG ?? 0),
    0
  );
  const total = version.totalProteinG;
  const diffTotal = Math.abs(sumFromIngredients - total);

  if (sumFromIngredients > 0 && diffTotal > 8) {
    return `totalProteinG is ${total}g but merged ingredient contributions sum to ~${Math.round(sumFromIngredients)}g.`;
  }

  const expectedDelta = version.totalProteinG - version.originalProteinG;
  if (Math.abs(expectedDelta - version.proteinDeltaG) > 4) {
    return `proteinDeltaG (${version.proteinDeltaG}g) inconsistent with total − baseline (${expectedDelta}g).`;
  }

  return null;
}

// ─── User message builder ─────────────────────────────────────────────────────
function buildUserMessage(
  dishInput: string,
  mode: Mode,
  servings: number,
  sliders?: GenerateRequest["sliders"]
): string {
  const lines = [
    `Transform: ${dishInput}`,
    `Mode: ${mode}`,
    `Servings: ${servings}`,
  ];

  if (sliders) {
    if (sliders.flavorPreservation !== undefined)
      lines.push(`Flavor preservation: ${sliders.flavorPreservation}/100`);
    if (sliders.proteinAggression !== undefined)
      lines.push(`Protein aggression: ${sliders.proteinAggression}/100`);
    if (sliders.ingredientRealism !== undefined)
      lines.push(`Ingredient realism: ${sliders.ingredientRealism}/100`);
  }

  lines.push("", "Output shape: ONE sharedRecipe (full baseline) + THREE tiers (Close Match, Balanced, Full Send).");
  lines.push(
    "First, mentally decompose the dish into slots: protein anchor, starch/structure, fat/flavor vehicle, " +
      "liquid/broth, acid/brightness, aromatics, garnish — baseline ingredients should cover each relevant slot."
  );
  lines.push(
    "sharedRecipe = real home-cooking baseline (original-protein level): full ingredients + full steps. " +
      "Use ingredient notes to tag slots when helpful (e.g. protein anchor, starch structure)."
  );
  lines.push(
    "Each tier = ingredientChanges + instructionChanges only vs baseline. Push protein up; when you trim fat or " +
      "smart-compress carbs, name the compensating move (stock, acid, blend, portion logic) so texture does not collapse."
  );
  lines.push(
    "Escalate across tiers: Close Match gentlest, Balanced middle, Full Send strongest. " +
      "Tiers can subsume prior-tier moves."
  );
  lines.push(
    "LENGTH GUARD — output MUST be valid complete JSON. Cap sharedRecipe to at most 18 ingredients and 12 instruction steps; " +
      "each tier at most 8 ingredientChanges and 6 instructionChanges. Merge substeps; avoid rambling, but steps and " +
      "methodAdjustments must still read like a real cook (full sentences, warm and clear — not telegraphic linter notes)."
  );
  lines.push(
    "Every tier MUST include transformationByComponent (5 slots) and methodAdjustments (2–8 short bullets). " +
      "Those fields are the primary UX — full merged recipe is supporting detail."
  );
  lines.push(
    "Non-redundancy: swapSummary carries operational deltas; transformationByComponent must frame changes by *slot role* " +
      "without repeating the exact pill wording. Stay concise in deltas; baseline carries narrative weight. " +
      "Write for cooks who care about mechanism and honesty."
  );

  const dishLower = dishInput.toLowerCase();
  const isBrothyDish =
    dishLower.includes("ramen") ||
    dishLower.includes("pho") ||
    dishLower.includes("broth") ||
    dishLower.includes("soup") ||
    dishLower.includes("noodle soup");

  if (isBrothyDish) {
    lines.push(
      "BROTH HARD RULE: Do NOT use cottage cheese, cream cheese, sour cream, or yogurt as broth enrichments. " +
      "Prefer broth-native protein moves only (extra primary protein, eggs where coherent, bone broth concentration, broth-safe neutral protein)."
    );
  }

  // Canonical defaults when user input is broad/unspecified.
  // This avoids vague "broth" outputs and enforces developed base logic.
  if (dishLower.includes("ramen")) {
    lines.push(
      "If user did not specify ramen subtype, default to shoyu chicken ramen (most common baseline). " +
      "sharedRecipe must be a full bowl: noodles, broth building blocks, tare/aroma, chicken, toppings; " +
      "steps through broth → noodles → assembly. Put extra protein moves in each tier's ingredientChanges + instructionChanges."
    );
  }
  if (dishLower.includes("pho") || dishLower.includes("pho bo") || dishLower.includes("pho ga")) {
    lines.push(
      "If user did not specify pho subtype, default to pho bo (beef) baseline. " +
      "Use a developed pho broth profile (charred aromatics + spice profile + long simmer), not generic stock wording."
    );
  }
  if (dishLower.includes("biryani")) {
    lines.push(
      "If user did not specify biryani style, default to chicken dum biryani baseline. " +
      "Use developed base language (marinade, birista, layered rice, dum finish) rather than generic 'stock/broth' wording."
    );
  }

  return lines.join("\n");
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    console.error("[generate] OPENAI_API_KEY is not set");
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    ensureIntegrity();

    const ip = getClientIp(req);
    const limited = checkGenerateRateLimit(ip, { max: 10, windowMs: 60_000 });
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before generating again." },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        }
      );
    }

    const body: GenerateRequest = await req.json();
    const {
      dish: dishInput,
      mode: requestMode,
      transformationMode,
      servings: rawServings,
      userGoal,
      sliders,
    } = body;

    const mode = requestMode ?? transformationMode ?? "proteinify";

    if (!dishInput || !mode) {
      return NextResponse.json({ error: "dish and mode are required" }, { status: 400 });
    }

    // Clamp servings to a sensible range
    const servings = Math.max(1, Math.min(12, Math.round(rawServings ?? 1)));
    const cacheKey = buildCacheKey({
      dish: dishInput,
      mode,
      servings,
      userGoal,
      sliders,
    });
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { headers: { "x-generate-cache": "hit" } });
    }

    const existingInflight = inflightRequests.get(cacheKey);
    if (existingInflight) {
      const shared = await existingInflight;
      return NextResponse.json(shared, { headers: { "x-generate-cache": "shared-inflight" } });
    }

    // ── DIL lookup ────────────────────────────────────────────────────────────
    const dilDish = getDishByIdOrAlias(dishInput);

    console.log(
      `[generate] dish="${dishInput}" | dil=${dilDish?.id ?? "unknown"} | mode=${mode} | servings=${servings} | goal=${userGoal ?? "none"}`
    );

    // ── Build system prompt ───────────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(mode, dilDish, servings);

    const generationPromise = (async (): Promise<GenerateResponse> => {
      // ── OpenAI call ─────────────────────────────────────────────────────────
      const proteinifySchema = getProteinifySchema();
      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4.1-mini",
        response_format: {
          type: "json_schema",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          json_schema: proteinifySchema as any,
        },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildUserMessage(dishInput, mode, servings, sliders) },
        ],
        temperature: 0.35,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
      });

      const choice = completion.choices[0];
      const raw = choice?.message?.content;
      if (!raw) {
        throw new Error("OpenAI returned empty response");
      }
      const finishReason = choice?.finish_reason ?? null;
      if (finishReason === "length") {
        console.warn(
          `[generate] completion truncated at max_completion_tokens=${MAX_COMPLETION_TOKENS} — consider shortening prompt or raising cap`
        );
      }

      // ── Parse + merge sharedRecipe + tiers into full VersionResult rows ─────
      let parsedObj: Record<string, unknown>;
      try {
        const root = parseModelJson(raw, { finishReason });
        if (!root || typeof root !== "object" || Array.isArray(root)) {
          throw new Error("Model root must be a JSON object.");
        }
        parsedObj = root as Record<string, unknown>;
      } catch (err) {
        if (err instanceof Error && err.message === "Failed to parse model output") {
          throw err;
        }
        console.error("[generate] unexpected parse error:", err);
        throw new Error("Failed to parse model output");
      }

      const mergedVersions = expandParsedToMergedVersions(parsedObj);
      const dishOut = typeof parsedObj.dish === "string" ? parsedObj.dish : dishInput;
      const taglineOut = typeof parsedObj.tagline === "string" ? parsedObj.tagline : "";

      // ── DIL validation + protein math check per version ───────────────────
      const telemetryEvents: unknown[] = [];

      const versionsWithValidation: VersionResult[] = mergedVersions.map((version) => {
        const proteinMathWarning = checkProteinMath(version);
        if (proteinMathWarning) {
          console.warn(`[generate] protein math: ${version.name} — ${proteinMathWarning}`);
        }

        if (!dilDish || version.appliedSwapCodes.length === 0) {
          return { ...version, dilValidation: null, proteinMathWarning };
        }

        const swapInputs: SwapInput[] = version.appliedSwapCodes.map((code) => ({
          code,
          quantity: "significant" as const,
        }));

        const dilValidation = validateSwap(dilDish, swapInputs, {
          userGoal: userGoal ?? "general",
          onEvent: (e) => {
            telemetryEvents.push(e);
            console.log(
              `[dil] "${version.name}" valid=${e.isValid} violations=${e.violationCodes.join(",") || "none"}`
            );
          },
        });

        return { ...version, dilValidation, proteinMathWarning };
      });

      const response: GenerateResponse = {
        dish: dishOut,
        tagline: taglineOut,
        dilDishId: dilDish?.id ?? null,
        dilRecognised: !!dilDish,
        servings,
        versions: versionsWithValidation,
      };

      setCachedResponse(cacheKey, response);
      return response;
    })();

    inflightRequests.set(cacheKey, generationPromise);
    try {
      const response = await generationPromise;
      return NextResponse.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal server error";
      const status = message.includes("parse") || message.includes("empty response") ? 502 : 500;
      return NextResponse.json({ error: message }, { status });
    } finally {
      inflightRequests.delete(cacheKey);
    }
  } catch (err) {
    console.error("[generate] unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
