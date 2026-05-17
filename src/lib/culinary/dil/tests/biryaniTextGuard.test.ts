import { describe, it, expect } from "vitest";
import {
  checkBiryaniTierText,
  hasBiryaniTextBlockers,
  biryaniTextHitsToValidationResult,
} from "../biryaniTextGuard";
import type { BiryaniTierTextSource } from "../biryaniTextGuard";

function sample(overrides: Partial<BiryaniTierTextSource>): BiryaniTierTextSource {
  return {
    summary: "Gentle protein lift.",
    swapSummary: ["+20% chicken"],
    transformationByComponent: {
      protein: ["More chicken breast"],
      carbBase: ["Unchanged basmati"],
      sauceBroth: ["Unchanged tomato base"],
      fat: ["-10% ghee"],
      toppings: ["Unchanged herbs"],
    },
    methodAdjustments: ["Marinate longer in yogurt."],
    ingredients: [{ name: "Chicken breast", note: "protein anchor" }],
    instructions: [{ step: "Layer rice and dum 25 minutes." }],
    ...overrides,
  };
}

describe("biryaniTextGuard", () => {
  it("flags cottage cheese in marinade prose", () => {
    const hits = checkBiryaniTierText(
      sample({
        ingredients: [{ name: "Cottage cheese, blended smooth", note: "marinade" }],
        summary: "Max protein with cottage cheese in marinade.",
      })
    );
    expect(hasBiryaniTextBlockers(hits)).toBe(true);
    expect(hits.some((h) => h.code === "cottage-cheese-biryani-marinade")).toBe(true);
  });

  it("flags dominant lentil-rice blend", () => {
    const hits = checkBiryaniTierText(
      sample({
        transformationByComponent: {
          protein: [],
          carbBase: ["Replace basmati with lentil rice blend 50/50"],
          sauceBroth: [],
          fat: [],
          toppings: [],
        },
      })
    );
    expect(hits.some((h) => h.code === "lentil-rice-dominant-biryani")).toBe(true);
  });

  it("flags orphan whey-after-cook step", () => {
    const hits = checkBiryaniTierText(
      sample({
        instructions: [{ step: "After cooking, mix whey isolate into marinade off heat." }],
      })
    );
    expect(hits.some((h) => h.code === "orphan-whey-biryani-step")).toBe(true);
  });

  it("allows konjac blend wording", () => {
    const hits = checkBiryaniTierText(
      sample({
        transformationByComponent: {
          protein: [],
          carbBase: ["Konjac rice substitute 25% blended with basmati, drained"],
          sauceBroth: [],
          fat: [],
          toppings: [],
        },
        ingredients: [{ name: "Basmati and konjac blend", note: "starch" }],
      })
    );
    expect(hits.some((h) => h.code === "lentil-rice-dominant-biryani")).toBe(false);
    expect(hits.some((h) => h.code === "cottage-cheese-biryani-marinade")).toBe(false);
  });

  it("produces invalid ValidationResult when blockers present", () => {
    const hits = checkBiryaniTierText(
      sample({ ingredients: [{ name: "Cottage cheese", note: "" }] })
    );
    const vr = biryaniTextHitsToValidationResult(hits);
    expect(vr?.isValid).toBe(false);
    expect(vr?.violations.some((v) => v.severity === "blocker")).toBe(true);
  });
});
