import { getGuardsForDish } from "@/lib/culinary/dil/loader";
import type { DishDNA } from "@/lib/culinary/dil/schemas";
import { patchCompactWiseDishSchema } from "@/lib/wisedish/ai/compactSchemaPatch";

/**
 * When a dish is in DIL, constrain appliedSwapCodes to valid guard codes for that dish.
 */
export function patchWiseDishSchemaForDil(base: unknown, dilDish: DishDNA | null): unknown {
  const withTierFields = patchCompactWiseDishSchema(base);
  if (!dilDish) return withTierFields;

  const codes = getGuardsForDish(dilDish).map((g) => g.code);
  if (codes.length === 0) return withTierFields;

  const cloned = JSON.parse(JSON.stringify(withTierFields)) as {
    schema?: {
      properties?: {
        versions?: {
          items?: {
            properties?: {
              appliedSwapCodes?: unknown;
            };
          };
        };
      };
    };
  };

  const applied = cloned.schema?.properties?.versions?.items?.properties?.appliedSwapCodes;
  if (!applied || typeof applied !== "object") {
    console.warn("[dilSchemaPatch] appliedSwapCodes not found; using base schema");
    return withTierFields;
  }

  cloned.schema!.properties!.versions!.items!.properties!.appliedSwapCodes = {
    type: "array",
    description:
      "Swap guard codes applied in this tier. Use only codes valid for this dish (empty array if none).",
    items: {
      type: "string",
      enum: codes,
    },
  };

  return cloned;
}
