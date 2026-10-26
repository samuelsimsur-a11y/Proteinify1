import { describe, expect, it, vi } from "vitest";

const version = (name: string, delta: number) => ({
  name,
  summary: `${name} summary`,
  proteinDeltaG: delta,
  originalProteinG: 22,
  totalProteinG: 22 + delta,
  cookTimeMinutes: 60,
  difficulty: "Medium",
  swapSummary: [],
  transformationByComponent: { protein: ["More chicken"], carbBase: [], sauceBroth: [], fat: [], toppings: [] },
  methodAdjustments: ["One", "Two"],
  ingredients: [{ name: "Chicken", amount: "200g", proteinContributionG: 40, note: "anchor" }],
  instructions: [{ step: "Dum cook.", heatGuard: null, textureNote: null }],
  mealPrepNote: null,
});

vi.mock("@/data/exampleResults.json", () => ({
  default: {
    version: 1,
    generatedAt: "2026-10-26T00:00:00.000Z",
    examples: {
      "wisedish:biryani": {
        dish: "biryani",
        tagline: "More chicken, same dum.",
        versions: [version("Close Match", 12), version("Balanced", 24), version("Full Send", 34)],
      },
      "wisedish:broken": { dish: "broken", versions: [] },
    },
  },
}));

describe("baked examples", () => {
  it("returns a parsed result for a baked dish, case-insensitively", async () => {
    const { getBakedExample, bestProteinGain } = await import("./examples");
    const r = getBakedExample("Biryani", "wisedish");
    expect(r?.versions).toHaveLength(3);
    expect(bestProteinGain(r)).toBe(34);
  });

  it("returns null for missing, broken or other-mode examples", async () => {
    const { getBakedExample } = await import("./examples");
    expect(getBakedExample("ramen", "wisedish")).toBeNull();
    expect(getBakedExample("broken", "wisedish")).toBeNull();
    expect(getBakedExample("biryani", "lean")).toBeNull();
  });
});
