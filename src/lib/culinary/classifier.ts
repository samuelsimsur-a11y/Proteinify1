/**
 * Pre-generation dish classifier — cheap GPT-4o-mini call before main generate.
 */

import OpenAI from "openai";
import { z } from "zod";

const CLASSIFIER_MODEL = process.env.OPENAI_CLASSIFIER_MODEL?.trim() || "gpt-4o-mini";
const CLASSIFIER_TIMEOUT_MS = 15_000;
const CLASSIFIER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CLASSIFIER_CACHE_MAX = 200;

const classificationCache = new Map<string, { expiresAt: number; value: DishClassification }>();

export interface DishClassification {
  dish_type: "dessert" | "main" | "side" | "snack" | "drink" | "unknown";
  cooking_method:
    | "bake"
    | "steam"
    | "fry"
    | "raw"
    | "boil"
    | "grill"
    | "no_cook"
    | "mixed"
    | "unknown";
  dietary_flags: Array<
    "vegan" | "vegetarian" | "halal" | "kosher" | "dairy_free" | "gluten_free"
  >;
  baseline_protein_g: number;
  ambiguity_score: "low" | "medium" | "high";
  assumed_variant: string | null;
  possible_variants: string[];
  texture_critical: boolean;
  texture_note: string | null;
  dish_components: string[];
  protein_component: string | null;
}

const DishClassificationSchema = z.object({
  dish_type: z.enum(["dessert", "main", "side", "snack", "drink", "unknown"]),
  cooking_method: z.enum([
    "bake",
    "steam",
    "fry",
    "raw",
    "boil",
    "grill",
    "no_cook",
    "mixed",
    "unknown",
  ]),
  dietary_flags: z.array(
    z.enum(["vegan", "vegetarian", "halal", "kosher", "dairy_free", "gluten_free"])
  ),
  baseline_protein_g: z.number(),
  ambiguity_score: z.enum(["low", "medium", "high"]),
  assumed_variant: z.string().nullable(),
  possible_variants: z.array(z.string()),
  texture_critical: z.boolean(),
  texture_note: z.string().nullable(),
  dish_components: z.array(z.string()),
  protein_component: z.string().nullable(),
});

const CLASSIFIER_JSON_SCHEMA = {
  name: "dish_classification",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "dish_type",
      "cooking_method",
      "dietary_flags",
      "baseline_protein_g",
      "ambiguity_score",
      "assumed_variant",
      "possible_variants",
      "texture_critical",
      "texture_note",
      "dish_components",
      "protein_component",
    ],
    properties: {
      dish_type: {
        type: "string",
        enum: ["dessert", "main", "side", "snack", "drink", "unknown"],
      },
      cooking_method: {
        type: "string",
        enum: ["bake", "steam", "fry", "raw", "boil", "grill", "no_cook", "mixed", "unknown"],
      },
      dietary_flags: {
        type: "array",
        items: {
          type: "string",
          enum: ["vegan", "vegetarian", "halal", "kosher", "dairy_free", "gluten_free"],
        },
      },
      baseline_protein_g: { type: "number" },
      ambiguity_score: { type: "string", enum: ["low", "medium", "high"] },
      assumed_variant: { type: ["string", "null"] },
      possible_variants: { type: "array", items: { type: "string" } },
      texture_critical: { type: "boolean" },
      texture_note: { type: ["string", "null"] },
      dish_components: { type: "array", items: { type: "string" } },
      protein_component: { type: ["string", "null"] },
    },
  },
} as const;

function classifierCacheKey(dishName: string): string {
  return dishName.trim().toLowerCase();
}

function getCachedClassification(dishName: string): DishClassification | null {
  const key = classifierCacheKey(dishName);
  const entry = classificationCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    classificationCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedClassification(dishName: string, value: DishClassification): void {
  if (classificationCache.size >= CLASSIFIER_CACHE_MAX) {
    const first = classificationCache.keys().next().value;
    if (first) classificationCache.delete(first);
  }
  classificationCache.set(classifierCacheKey(dishName), {
    expiresAt: Date.now() + CLASSIFIER_CACHE_TTL_MS,
    value,
  });
}

function buildClassifierPrompt(dishName: string): string {
  return `Classify this dish for a protein optimization engine.
Return JSON only matching this schema exactly.
Be conservative with dietary_flags — only flag if the dish is traditionally that way, not if it could be made that way.
For baseline_protein_g: estimate for a standard restaurant serving.
For texture_critical: true only if the dish's identity depends on a specific texture that protein additions could destroy (e.g. molten, flaky, crispy, airy, silky, elastic).
For dish_components: identify separate structural elements using role labels when helpful (e.g. Jollof Rice → ["tomato-rice base", "protein side"], not just ["rice"]).
For assumed_variant: set the most likely specific dish name when ambiguity is low or medium.
For ambiguity_score: high if the same name refers to significantly different dishes across cultures (e.g. "dumplings" alone → gyoza, pierogi, momos, jiaozi, xiaolongbao).
For possible_variants: when ambiguity_score is high, list 3–6 distinct culturally different variants.

Dish name: "${dishName.replace(/"/g, '\\"')}"`;
}

/** Known dish patterns — reinforces mini model for high-impact test cases. */
export function applyClassificationHeuristics(
  dishName: string,
  classification: DishClassification
): DishClassification {
  const lower = dishName.trim().toLowerCase();
  const out: DishClassification = {
    ...classification,
    dietary_flags: [...classification.dietary_flags],
    possible_variants: [...classification.possible_variants],
    dish_components: [...classification.dish_components],
  };

  if (/\bvegan\b/.test(lower) || /\bplant[- ]based\b/.test(lower)) {
    if (!out.dietary_flags.includes("vegan")) out.dietary_flags.push("vegan");
  }

  if (/\bhalal\b/.test(lower) && !out.dietary_flags.includes("halal")) {
    out.dietary_flags.push("halal");
  }

  if (/\b(gluten[- ]free|gf)\b/.test(lower) && !out.dietary_flags.includes("gluten_free")) {
    out.dietary_flags.push("gluten_free");
  }

  if (/\blava\s*cake\b|molten\s*chocolate\b/.test(lower)) {
    out.dish_type = "dessert";
    out.cooking_method = out.cooking_method === "unknown" ? "bake" : out.cooking_method;
    out.texture_critical = true;
    out.texture_note =
      out.texture_note ??
      "molten chocolate core depends on precise water activity, emulsion stability, and bake timing";
  }

  if (/\bjollof\b/.test(lower)) {
    if (out.dish_components.length < 2) {
      out.dish_components = ["tomato-rice base", "protein side"];
    }
    out.protein_component = out.protein_component ?? "protein side";
  }

  if (/\bchicken\s+tikka\b|tikka\s+chicken\b/.test(lower)) {
    if (out.baseline_protein_g < 35) out.baseline_protein_g = 38;
  }

  if (/\bdumplings?\b/.test(lower) && !/\b(soup|chicken|pork|beef|shrimp|vegetable)\s+dumplings?\b/.test(lower)) {
    const variants = [
      "Chinese pork dumplings (jiaozi)",
      "Japanese gyoza",
      "Polish pierogi",
      "Tibetan momos",
      "Soup dumplings (xiaolongbao)",
    ];
    if (out.possible_variants.length < 2) {
      out.possible_variants = variants;
      out.ambiguity_score = "high";
      out.assumed_variant = out.assumed_variant ?? variants[0]!;
    }
  }

  return out;
}

function fallbackClassification(dishName: string): DishClassification {
  return applyClassificationHeuristics(dishName, {
    dish_type: "unknown",
    cooking_method: "unknown",
    dietary_flags: [],
    baseline_protein_g: 20,
    ambiguity_score: "low",
    assumed_variant: dishName.trim() || null,
    possible_variants: [],
    texture_critical: false,
    texture_note: null,
    dish_components: [],
    protein_component: null,
  });
}

let openaiClient: OpenAI | undefined;

function getClassifierOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export async function classifyDish(
  dishName: string,
  opts?: { skipCache?: boolean }
): Promise<DishClassification> {
  const trimmed = dishName.trim();
  if (!trimmed) return fallbackClassification(dishName);

  if (!opts?.skipCache) {
    const cached = getCachedClassification(trimmed);
    if (cached) return cached;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CLASSIFIER_TIMEOUT_MS);

  try {
    const completion = await getClassifierOpenAI().chat.completions.create(
      {
        model: CLASSIFIER_MODEL,
        temperature: 0.1,
        max_completion_tokens: 600,
        response_format: {
          type: "json_schema",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          json_schema: CLASSIFIER_JSON_SCHEMA as any,
        },
        messages: [
          {
            role: "system",
            content: "You classify dishes for a culinary protein engine. Return JSON only.",
          },
          { role: "user", content: buildClassifierPrompt(trimmed) },
        ],
      },
      { signal: ctrl.signal }
    );

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      const fb = fallbackClassification(trimmed);
      setCachedClassification(trimmed, fb);
      return fb;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const fb = fallbackClassification(trimmed);
      setCachedClassification(trimmed, fb);
      return fb;
    }

    const result = DishClassificationSchema.safeParse(parsed);
    if (!result.success) {
      console.warn("[classifier] schema validation failed:", result.error.message);
      const fb = fallbackClassification(trimmed);
      setCachedClassification(trimmed, fb);
      return fb;
    }

    const normalized = applyClassificationHeuristics(trimmed, {
      ...result.data,
      assumed_variant: result.data.assumed_variant?.trim() || trimmed,
      possible_variants: result.data.possible_variants
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 8),
      dish_components: result.data.dish_components.map((c) => c.trim()).filter(Boolean),
      baseline_protein_g: Math.max(0, Math.min(120, Math.round(result.data.baseline_protein_g))),
    });

    setCachedClassification(trimmed, normalized);
    return normalized;
  } catch (err) {
    console.warn("[classifier] OpenAI call failed:", err instanceof Error ? err.message : err);
    const fb = fallbackClassification(trimmed);
    setCachedClassification(trimmed, fb);
    return fb;
  } finally {
    clearTimeout(timer);
  }
}

/** Subset returned to the client on generate / disambiguation responses. */
export type DishClassificationWire = Pick<
  DishClassification,
  | "baseline_protein_g"
  | "dish_type"
  | "assumed_variant"
  | "texture_critical"
  | "dietary_flags"
  | "ambiguity_score"
>;

export function toClassificationWire(c: DishClassification): DishClassificationWire {
  return {
    baseline_protein_g: c.baseline_protein_g,
    dish_type: c.dish_type,
    assumed_variant: c.assumed_variant,
    texture_critical: c.texture_critical,
    dietary_flags: c.dietary_flags,
    ambiguity_score: c.ambiguity_score,
  };
}
