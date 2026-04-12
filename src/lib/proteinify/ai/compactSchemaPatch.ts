/**
 * Extends the compact generate JSON schema (loaded from DIL) with tier-level
 * cook time and difficulty — without editing files under `culinary/dil/`.
 */
export function patchCompactProteinifySchema(base: unknown): unknown {
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

  items.required = Array.from(new Set([...items.required, "cookTimeMinutes", "difficulty"]));
  return cloned;
}
