/**
 * Extends the compact generate JSON schema (loaded from DIL) with tier-level
 * cook time and difficulty — without editing files under `culinary/dil/`.
 */
export function patchCompactWiseDishSchema(base: unknown): unknown {
  const cloned = JSON.parse(JSON.stringify(base)) as {
    schema?: {
      properties?: {
        versions?: {
          items?: {
            required?: string[];
            properties?: Record<string, unknown>;
          };
        };
      };
    };
  };

  const items = cloned.schema?.properties?.versions?.items;
  if (!items?.properties || !Array.isArray(items.required)) {
    console.warn("[compactSchemaPatch] unexpected schema shape; using base schema");
    return base;
  }

  items.properties.cookTimeMinutes = {
    type: "number",
    description:
      "Estimated total minutes (active prep + unattended cook) for this tier’s merged recipe — one realistic home-cook number per tier.",
  };
  items.properties.difficulty = {
    type: "string",
    enum: ["Easy", "Medium", "Takes effort"],
    description: "Overall effort/skill for this tier after applying its swaps.",
  };

  items.properties.caloriesPerServing = {
    type: "number",
    description:
      "Estimated kcal per serving for this tier’s merged recipe (honest home-cook estimate; Lean Mode users rely on it).",
  };

  items.required = Array.from(
    new Set([...items.required, "cookTimeMinutes", "difficulty", "caloriesPerServing"])
  );

  const shared = (cloned.schema?.properties as Record<string, { properties?: Record<string, unknown>; required?: string[] }>)
    ?.sharedRecipe;
  if (shared?.properties && Array.isArray(shared.required)) {
    shared.properties.originalCaloriesPerServing = {
      type: "number",
      description: "Estimated kcal per serving of the baseline (original) recipe.",
    };
    shared.required = Array.from(new Set([...shared.required, "originalCaloriesPerServing"]));
  }
  return cloned;
}

/** Strict JSON schema for regenerating a single tier after an ingredient swap. */
export function buildSingleTierSwapSchema(): unknown {
  const stringArray = (maxItems: number) => ({ type: "array", maxItems, items: { type: "string" } });
  return {
    name: "wisedish_single_tier_swap",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "swapNote",
        "summary",
        "originalProteinG",
        "proteinDeltaG",
        "totalProteinG",
        "originalCaloriesPerServing",
        "caloriesPerServing",
        "cookTimeMinutes",
        "difficulty",
        "swapSummary",
        "transformationByComponent",
        "methodAdjustments",
        "ingredients",
        "instructions",
        "mealPrepNote",
      ],
      properties: {
        swapNote: {
          type: "string",
          description: "One short sentence for the cook: what you changed and why (mention a safer alternative if you could not do exactly what they asked).",
        },
        summary: { type: "string", description: "One sentence: trade-offs for this tier vs baseline" },
        originalProteinG: { type: "number", description: "Baseline (original recipe) protein per serving — keep the value you were given." },
        proteinDeltaG: { type: "number", description: "totalProteinG − originalProteinG" },
        totalProteinG: { type: "number", description: "Protein per serving after the edit; must match the ingredient rows (approx)." },
        originalCaloriesPerServing: { type: "number", description: "Estimated kcal per serving of the original recipe." },
        caloriesPerServing: { type: "number", description: "Estimated kcal per serving of this tier after the edit." },
        cookTimeMinutes: { type: "number" },
        difficulty: { type: "string", enum: ["Easy", "Medium", "Takes effort"] },
        swapSummary: stringArray(4),
        transformationByComponent: {
          type: "object",
          additionalProperties: false,
          required: ["protein", "carbBase", "sauceBroth", "fat", "toppings"],
          properties: {
            protein: stringArray(4),
            carbBase: stringArray(4),
            sauceBroth: stringArray(4),
            fat: stringArray(4),
            toppings: stringArray(4),
          },
        },
        methodAdjustments: { type: "array", minItems: 2, maxItems: 8, items: { type: "string" } },
        ingredients: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "amount", "proteinContributionG", "note"],
            properties: {
              name: { type: "string" },
              amount: { type: "string" },
              proteinContributionG: { type: "number" },
              note: { type: "string" },
            },
          },
        },
        instructions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["step", "heatGuard", "textureNote"],
            properties: {
              step: { type: "string" },
              heatGuard: { type: ["string", "null"] },
              textureNote: { type: ["string", "null"] },
            },
          },
        },
        mealPrepNote: { type: ["string", "null"] },
      },
    },
  };
}
