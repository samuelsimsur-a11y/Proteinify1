import { describe, it, expect } from "vitest";
import { applyClassificationHeuristics } from "../classifier";
import type { DishClassification } from "../classifier";

function base(): DishClassification {
  return {
    dish_type: "main",
    cooking_method: "mixed",
    dietary_flags: [],
    baseline_protein_g: 20,
    ambiguity_score: "low",
    assumed_variant: "test",
    possible_variants: [],
    texture_critical: false,
    texture_note: null,
    dish_components: [],
    protein_component: null,
  };
}

describe("applyClassificationHeuristics", () => {
  it("flags vegan lentil dal as vegan", () => {
    const c = applyClassificationHeuristics("Vegan Lentil Dal", base());
    expect(c.dietary_flags).toContain("vegan");
  });

  it("sets jollof component boundaries", () => {
    const c = applyClassificationHeuristics("Jollof Rice", base());
    expect(c.dish_components.length).toBeGreaterThanOrEqual(2);
    expect(c.protein_component).toBe("protein side");
  });

  it("raises chicken tikka baseline protein", () => {
    const c = applyClassificationHeuristics("Chicken Tikka", base());
    expect(c.baseline_protein_g).toBeGreaterThanOrEqual(35);
  });

  it("marks dumplings as high ambiguity", () => {
    const c = applyClassificationHeuristics("Dumplings", base());
    expect(c.ambiguity_score).toBe("high");
    expect(c.possible_variants.length).toBeGreaterThan(1);
  });

  it("marks lava cake as dessert and texture critical", () => {
    const c = applyClassificationHeuristics("Chocolate Lava Cake", base());
    expect(c.dish_type).toBe("dessert");
    expect(c.texture_critical).toBe(true);
  });
});

