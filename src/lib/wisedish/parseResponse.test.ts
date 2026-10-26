import { describe, expect, it } from "vitest";
import { parseWireVersion, parseWiseDishResponseJson } from "./parseResponse";

const wire = (name: string, delta: number, extra: Record<string, unknown> = {}) => ({
  name,
  summary: `${name} summary`,
  proteinDeltaG: delta,
  originalProteinG: 20,
  totalProteinG: 20 + delta,
  cookTimeMinutes: 30,
  difficulty: "Easy",
  swapSummary: ["+ chicken"],
  transformationByComponent: { protein: ["More chicken"], carbBase: [], sauceBroth: [], fat: [], toppings: [] },
  methodAdjustments: ["Step one", "Step two"],
  ingredients: [{ name: "Chicken", amount: "150g", proteinContributionG: 30, note: "anchor" }],
  instructions: [{ step: "Cook.", heatGuard: "Low heat.", textureNote: null }],
  mealPrepNote: null,
  proteinMathWarning: null,
  dilConsistencyWarning: null,
  ...extra,
});

describe("parseWireVersion", () => {
  it("maps calories and does not invent swap options", () => {
    const v = parseWireVersion(wire("Balanced", 15, { originalCaloriesPerServing: 700, caloriesPerServing: 620 }), 1);
    expect(v?.id).toBe("balanced");
    expect(v?.calories).toEqual({ before: 700, after: 620 });
    expect(v?.ingredients[0]?.swapOptions).toEqual([]);
    expect(v?.steps[0]).toBe("Cook. Low heat.");
  });

  it("accepts a negative protein delta (Lean tiers can trade a little protein)", () => {
    const v = parseWireVersion(wire("Full Send", -3), 2);
    expect(v?.macros.d).toBe(-3);
  });

  it("omits calories when the server sent none", () => {
    expect(parseWireVersion(wire("Close Match", 8), 0)?.calories).toBeUndefined();
  });
});

describe("parseWiseDishResponseJson", () => {
  it("parses a full three-version response", () => {
    const r = parseWiseDishResponseJson({
      dish: "curry",
      tagline: "More chicken.",
      versions: [wire("Close Match", 8), wire("Balanced", 15), wire("Full Send", 25)],
    });
    expect("ok" in r && r.ok).toBe(true);
    if ("ok" in r && r.ok) {
      expect(r.data.versions.map((v) => v.id)).toEqual(["close-match", "balanced", "max-protein"]);
    }
  });
});
