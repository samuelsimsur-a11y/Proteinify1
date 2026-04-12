import type OpenAI from "openai";

/**
 * Strict JSON Schemas for Chat Completions Structured Outputs.
 * Shapes match {@link parseProteinifyResponseJson} / {@link parseSingleVersionAiJson} — same wire fields as prompts (summary, macros.p/d, ingredients.swapOptions, etc.).
 */
const swapTypeEnum = {
  type: "string",
  enum: [
    "more-authentic",
    "higher-protein",
    "more-common",
    "cheaper",
    "dairy-free",
    "vegetarian",
    "simpler",
  ],
} as const;

const swapOptionSchema = {
  type: "object",
  properties: {
    type: swapTypeEnum,
    label: { type: "string" },
    replacement: { type: "string" },
    effect: { type: "string" },
  },
  required: ["type", "label", "replacement", "effect"],
  additionalProperties: false,
} as const;

const ingredientSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    original: { type: "string" },
    current: { type: "string" },
    amount: { type: "string" },
    reason: { type: "string" },
    proteinPer100g: { type: "number" },
    fatPer100g: { type: "number" },
    carbsPer100g: { type: "number" },
    caloriesPer100g: { type: "number" },
    swapOptions: {
      type: "array",
      items: swapOptionSchema,
      minItems: 2,
      maxItems: 4,
    },
  },
  required: [
    "id",
    "original",
    "current",
    "amount",
    "reason",
    "proteinPer100g",
    "fatPer100g",
    "carbsPer100g",
    "caloriesPer100g",
    "swapOptions",
  ],
  additionalProperties: false,
} as const;

const additionItemSchema = {
  type: "object",
  properties: {
    note: { type: "string" },
  },
  required: ["note"],
  additionalProperties: false,
} as const;

const versionMacrosSchema = {
  type: "object",
  properties: {
    p: { type: "number", description: "Estimated grams protein per serving" },
    d: { type: "number", description: "Protein gain vs typical original serving (non-negative)" },
  },
  required: ["p", "d"],
  additionalProperties: false,
} as const;

/** One recipe version — same object for full `versions[]` and single-regenerate `version`. */
const recipeVersionSchema = {
  type: "object",
  properties: {
    id: {
      type: "string",
      enum: ["close-match", "balanced", "max-protein"],
    },
    label: {
      type: "string",
      enum: ["Close Match", "Balanced", "Full Send", "Fully Light"],
    },
    summary: { type: "string" },
    macros: versionMacrosSchema,
    tasteScore: { type: "number" },
    realismScore: { type: "number" },
    aggressivenessScore: { type: "number" },
    cookTimeMinutes: {
      type: "number",
      description: "Estimated total prep + cook minutes for this version",
    },
    difficulty: {
      type: "string",
      enum: ["Easy", "Medium", "Takes effort"],
      description: "Skill/effort level for this version",
    },
    why: { type: "string" },
    adds: {
      type: "array",
      items: additionItemSchema,
      maxItems: 3,
    },
    ingredients: {
      type: "array",
      items: ingredientSchema,
    },
    steps: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "id",
    "label",
    "summary",
    "macros",
    "tasteScore",
    "realismScore",
    "aggressivenessScore",
    "cookTimeMinutes",
    "difficulty",
    "why",
    "adds",
    "ingredients",
    "steps",
  ],
  additionalProperties: false,
} as const;

const fullRootSchema = {
  type: "object",
  properties: {
    inputDish: { type: "string" },
    assumptions: {
      type: "array",
      items: { type: "string" },
    },
    versions: {
      type: "array",
      items: recipeVersionSchema,
      minItems: 3,
      maxItems: 3,
    },
  },
  required: ["inputDish", "assumptions", "versions"],
  additionalProperties: false,
} as const;

const singleVersionRootSchema = {
  type: "object",
  properties: {
    inputDish: { type: "string" },
    assumptions: {
      type: "array",
      items: { type: "string" },
    },
    version: recipeVersionSchema,
  },
  required: ["inputDish", "assumptions", "version"],
  additionalProperties: false,
} as const;

/** Full 3-version generate — matches wire shape validated by parseProteinifyResponseJson. */
export const proteinifyFullResponseFormat: OpenAI.ResponseFormatJSONSchema = {
  type: "json_schema",
  json_schema: {
    name: "proteinify_result",
    strict: true,
    description:
      "Proteinify full response: inputDish, assumptions, and exactly three versions (close-match, balanced, max-protein) with ingredients, swapOptions, steps, macros.p/d, why, adds.",
    schema: { ...fullRootSchema } as Record<string, unknown>,
  },
};

/** Single-slot regenerate — matches wire shape for parseSingleVersionAiJson (version object). */
export const proteinifySingleVersionResponseFormat: OpenAI.ResponseFormatJSONSchema = {
  type: "json_schema",
  json_schema: {
    name: "proteinify_single_version",
    strict: true,
    description:
      "Regenerate one version only: inputDish, assumptions, and one version object matching the target slot id/label.",
    schema: { ...singleVersionRootSchema } as Record<string, unknown>,
  },
};
