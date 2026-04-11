import type OpenAI from "openai";

import { TECHNIQUE_CODES } from "@/lib/proteinify/expander/swapLibrary";

const techniqueCodeSchema = {
  type: "string",
  enum: [...TECHNIQUE_CODES],
} as const;

const compactSwapSchema = {
  type: "object",
  properties: {
    code: techniqueCodeSchema,
    amount: { type: "string", description: "Quantity or empty string if default" },
    target: { type: "string", description: "Ingredient or slot affected, or empty" },
    proteinDelta: { type: "number", description: "Estimated grams protein contributed" },
  },
  required: ["code", "amount", "target", "proteinDelta"],
  additionalProperties: false,
} as const;

const compactAddSchema = {
  type: "object",
  properties: {
    code: techniqueCodeSchema,
    amount: { type: "string" },
  },
  required: ["code", "amount"],
  additionalProperties: false,
} as const;

const compactMacrosSchema = {
  type: "object",
  properties: {
    p: { type: "number", description: "g protein per serving" },
    d: { type: "number", description: "protein gain vs typical original" },
    cal: { type: "number", description: "estimated kcal per serving (expander may ignore for wire)" },
  },
  required: ["p", "d", "cal"],
  additionalProperties: false,
} as const;

const compactVersionSchema = {
  type: "object",
  properties: {
    id: {
      type: "string",
      enum: ["close-match", "balanced", "max-protein"],
    },
    priorities: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 12,
    },
    swaps: {
      type: "array",
      items: compactSwapSchema,
      maxItems: 14,
    },
    adds: {
      type: "array",
      items: compactAddSchema,
      maxItems: 6,
    },
    macros: compactMacrosSchema,
    summaryOneLiner: {
      type: "string",
      description: "Max one sentence, ~15 words: what changed",
    },
    whyOneLiner: {
      type: "string",
      description: "Max one sentence, ~15 words: food-science why",
    },
  },
  required: ["id", "priorities", "swaps", "adds", "macros", "summaryOneLiner", "whyOneLiner"],
  additionalProperties: false,
} as const;

const compactRootShared = {
  inputDish: { type: "string" },
  assumptions: {
    type: "array",
    items: { type: "string" },
    maxItems: 12,
  },
  identityScore: {
    type: "number",
    description: "0-10 how load-bearing identity ingredients are",
  },
  fatVehicle: { type: "string" },
  acidAnchor: { type: "string" },
} as const;

const compactFullRootSchema = {
  type: "object",
  properties: {
    ...compactRootShared,
    versions: {
      type: "array",
      items: compactVersionSchema,
      minItems: 3,
      maxItems: 3,
    },
  },
  required: ["inputDish", "assumptions", "identityScore", "fatVehicle", "acidAnchor", "versions"],
  additionalProperties: false,
} as const;

const compactSingleRootSchema = {
  type: "object",
  properties: {
    ...compactRootShared,
    version: compactVersionSchema,
  },
  required: ["inputDish", "assumptions", "identityScore", "fatVehicle", "acidAnchor", "version"],
  additionalProperties: false,
} as const;

/** Full 3-version generate — model outputs compact decision objects only. */
export const proteinifyCompactFullResponseFormat: OpenAI.ResponseFormatJSONSchema = {
  type: "json_schema",
  json_schema: {
    name: "proteinify_compact_result",
    strict: true,
    description:
      "Compact culinary decisions: inputDish, assumptions, identity anchors, three versions with technique codes only (no long prose). Expander maps codes to app wire.",
    schema: { ...compactFullRootSchema } as Record<string, unknown>,
  },
};

/** Single-slot regenerate — one compact version + shared anchors. */
export const proteinifyCompactSingleVersionResponseFormat: OpenAI.ResponseFormatJSONSchema = {
  type: "json_schema",
  json_schema: {
    name: "proteinify_compact_single",
    strict: true,
    description:
      "Regenerate one version: same root anchors as full compact, single version object with technique codes.",
    schema: { ...compactSingleRootSchema } as Record<string, unknown>,
  },
};
