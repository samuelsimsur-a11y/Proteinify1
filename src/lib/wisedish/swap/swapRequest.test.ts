import { describe, expect, it } from "vitest";
import { buildSwapUserMessage, validateSwapRequest } from "./swapRequest";

const base = {
  tier: "balanced",
  intent: "higher-protein",
  ingredient: { name: "Sharp cheddar", amount: "1/2 cup" },
  version: {
    summary: "Noticeably higher protein",
    originalProteinG: 18,
    totalProteinG: 48,
    cookTimeMinutes: 30,
    difficulty: "Easy",
    ingredients: [
      { name: "Elbow pasta", amount: "100g", note: "structure" },
      { name: "Sharp cheddar", amount: "1/2 cup", note: "flavor" },
    ],
    steps: ["Boil pasta.", "Melt cheese."],
    methodAdjustments: ["Blend cottage cheese", "Keep sauce off a boil"],
    swapSummary: ["+ Greek yogurt"],
  },
};

describe("validateSwapRequest", () => {
  it("accepts a well-formed request", () => {
    const r = validateSwapRequest(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.tier).toBe("balanced");
      expect(r.value.version.ingredients).toHaveLength(2);
      expect(r.value.version.caloriesPerServing).toBeNull();
    }
  });

  it("rejects unknown tiers and intents", () => {
    expect(validateSwapRequest({ ...base, tier: "legendary" }).ok).toBe(false);
    expect(validateSwapRequest({ ...base, intent: "delete-everything" }).ok).toBe(false);
  });

  it("requires a replacement for free-text swaps", () => {
    expect(validateSwapRequest({ ...base, intent: "replace" }).ok).toBe(false);
    expect(validateSwapRequest({ ...base, intent: "replace", replacement: "  gruyère  " }).ok).toBe(true);
  });

  it("requires the current recipe", () => {
    expect(validateSwapRequest({ ...base, version: { ...base.version, ingredients: [] } }).ok).toBe(false);
  });

  it("strips control characters and caps lengths", () => {
    const r = validateSwapRequest({ ...base, intent: "replace", replacement: "feta\u0000\u0007" + "x".repeat(200) });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.replacement).not.toMatch(/[\u0000\u0007]/);
      expect(r.value.replacement!.length).toBeLessThanOrEqual(80);
    }
  });
});

describe("buildSwapUserMessage", () => {
  it("names the tier, the ingredient and the request", () => {
    const r = validateSwapRequest({ ...base, intent: "replace", replacement: "gruyère" });
    if (!r.ok) throw new Error("invalid");
    const msg = buildSwapUserMessage("mac & cheese", r.value);
    expect(msg).toContain("Balanced version");
    expect(msg).toContain('"1/2 cup Sharp cheddar"');
    expect(msg).toContain('"gruyère"');
    expect(msg).toContain("originalProteinG = 18");
  });
});
