import { describe, expect, it } from "vitest";
import { scaleIngredientAmount, scaleQuantityText } from "./scaleQuantity";

describe("scaleQuantityText", () => {
  it("scales simple metric amounts", () => {
    expect(scaleQuantityText("100g", 3)).toBe("300g");
    expect(scaleQuantityText("150 g", 2)).toBe("300 g");
    expect(scaleQuantityText("500ml", 0.5)).toBe("250ml");
  });

  it("scales fractions as whole quantities, not just the denominator", () => {
    expect(scaleQuantityText("1/2 cup", 3)).toBe("1 1/2 cup");
    expect(scaleQuantityText("1/2 cup", 2)).toBe("1 cup");
    expect(scaleQuantityText("3/4 tsp", 2)).toBe("1 1/2 tsp");
  });

  it("scales mixed numbers and unicode fractions", () => {
    expect(scaleQuantityText("1 1/2 cups", 2)).toBe("3 cups");
    expect(scaleQuantityText("½ cup", 3)).toBe("1½ cup");
    expect(scaleQuantityText("1½ tbsp", 2)).toBe("3 tbsp");
  });

  it("scales both ends of a range", () => {
    expect(scaleQuantityText("140–180g", 3)).toBe("420–540g");
    expect(scaleQuantityText("2-3 tbsp", 2)).toBe("4-6 tbsp");
    expect(scaleQuantityText("2 to 3 cups", 2)).toBe("4 to 6 cups");
  });

  it("scales unitless counts with friendly fractions", () => {
    expect(scaleQuantityText("2 large eggs", 2)).toBe("4 large eggs");
    expect(scaleQuantityText("3 eggs", 0.5)).toBe("1 1/2 eggs");
  });

  it("scales every quantity in compound amounts", () => {
    expect(scaleQuantityText("2 tbsp + 1 tbsp", 2)).toBe("4 tbsp + 2 tbsp");
    expect(scaleQuantityText("1 can (400g)", 2)).toBe("2 can (800g)");
  });

  it("rounds grams sensibly", () => {
    expect(scaleQuantityText("100g", 1 / 3)).toBe("33g");
    expect(scaleQuantityText("250g", 4 / 3)).toBe("335g");
    expect(scaleQuantityText("5g", 1 / 2)).toBe("2.5g");
  });

  it("leaves non-quantities alone", () => {
    expect(scaleQuantityText("up to 30%", 2)).toBe("up to 30%");
    expect(scaleQuantityText("1:1 vs water/stock", 2)).toBe("1:1 vs water/stock");
    expect(scaleQuantityText("1-inch piece ginger", 2)).toBe("1-inch piece ginger");
    expect(scaleQuantityText("bake at 180°C", 2)).toBe("bake at 180°C");
    expect(scaleQuantityText("to taste", 2)).toBe("to taste");
    expect(scaleQuantityText("93/7 ground turkey", 2)).toBe("93/7 ground turkey");
  });

  it("never prints zero for a tiny amount", () => {
    expect(scaleQuantityText("1/8 tsp", 1 / 4)).toBe("1/8 tsp");
  });

  it("returns the input unchanged for factor 1", () => {
    expect(scaleQuantityText("1/2 cup", 1)).toBe("1/2 cup");
  });
});

describe("scaleIngredientAmount", () => {
  it("scales and rewrites the servings note", () => {
    expect(scaleIngredientAmount("400g (for 2 servings)", 2, 4)).toBe("800g (for 4 servings)");
  });
});
