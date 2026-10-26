import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Exercises /api/generate with the OpenAI client mocked, so the swap path, calorie fields and CORS
 * behaviour are covered without network access or an API key.
 */

type CreateArgs = { response_format?: { json_schema?: { name?: string } }; messages: { role: string; content: string }[] };
const calls: CreateArgs[] = [];

const tier = (name: string, delta: number, kcal: number) => ({
  name,
  summary: `${name} summary`,
  proteinDeltaG: delta,
  totalProteinG: 20 + delta,
  appliedSwapCodes: [],
  swapSummary: ["+ chicken"],
  transformationByComponent: { protein: ["More chicken"], carbBase: [], sauceBroth: [], fat: [], toppings: [] },
  methodAdjustments: ["Sear the chicken", "Fold in at the end"],
  ingredientChanges: [
    { action: "replace", targetSubstring: "chicken", name: "Chicken thigh", amount: "200g", proteinContributionG: 20 + delta - 8, note: "protein anchor" },
  ],
  instructionChanges: [],
  mealPrepNote: null,
  cookTimeMinutes: 40,
  difficulty: "Medium",
  caloriesPerServing: kcal,
});

const fullCompact = {
  dish: "chicken curry",
  tagline: "More chicken, same curry.",
  dilDishId: null,
  servings: 1,
  sharedRecipe: {
    originalProteinG: 20,
    originalCaloriesPerServing: 650,
    ingredients: [
      { name: "Chicken", amount: "120g", proteinContributionG: 12, note: "protein anchor" },
      { name: "Rice", amount: "1/2 cup", proteinContributionG: 8, note: "starch" },
    ],
    instructions: [{ step: "Cook the curry.", heatGuard: null, textureNote: null }],
  },
  versions: [tier("Close Match", 10, 640), tier("Balanced", 20, 600), tier("Full Send", 30, 580)],
};

const swapOutput = {
  swapNote: "Swapped rice for a lentil-rice mix (+6g).",
  summary: "Balanced with lentils",
  originalProteinG: 20,
  proteinDeltaG: 999, // deliberately wrong: the route must recompute from totals
  totalProteinG: 46,
  originalCaloriesPerServing: 650,
  caloriesPerServing: 590,
  cookTimeMinutes: 45,
  difficulty: "Medium",
  swapSummary: ["Lentil-rice mix"],
  transformationByComponent: { protein: ["More chicken"], carbBase: ["Half lentils"], sauceBroth: [], fat: [], toppings: [] },
  methodAdjustments: ["Cook lentils with the rice", "Season the same"],
  ingredients: [
    { name: "Chicken thigh", amount: "200g", proteinContributionG: 32, note: "protein anchor" },
    { name: "Rice + red lentils", amount: "1/2 cup", proteinContributionG: 14, note: "starch, more protein" },
  ],
  instructions: [{ step: "Cook rice and lentils together.", heatGuard: null, textureNote: null }],
  mealPrepNote: null,
};

vi.mock("openai", () => {
  class OpenAI {
    chat = {
      completions: {
        create: async (args: CreateArgs) => {
          calls.push(args);
          const name = args.response_format?.json_schema?.name;
          const content =
            name === "wisedish_single_tier_swap"
              ? JSON.stringify(swapOutput)
              : name === "dish_classification"
                ? "not json" // classifier falls back to heuristics
                : JSON.stringify(fullCompact);
          return { choices: [{ message: { content }, finish_reason: "stop" }] };
        },
      },
    };
  }
  return { default: OpenAI };
});

function post(body: unknown, origin = "https://localhost", ip = "10.0.0.1") {
  return new NextRequest("https://wisedish.vercel.app/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  calls.length = 0;
  vi.stubEnv("OPENAI_API_KEY", "test-key");
});

describe("POST /api/generate", () => {
  it("returns three versions with calorie estimates", async () => {
    const { POST } = await import("./route");
    const res = await POST(post({ dish: "chicken curry", transformationMode: "lean", servings: 1 }, "https://localhost", "10.0.0.2"));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://localhost");
    const json = await res.json();
    expect(json.versions).toHaveLength(3);
    expect(json.versions[0].originalCaloriesPerServing).toBe(650);
    expect(json.versions.map((v: { caloriesPerServing: number }) => v.caloriesPerServing)).toEqual([640, 600, 580]);
    const schemaName = calls.find((c) => c.response_format?.json_schema?.name !== "dish_classification")?.response_format
      ?.json_schema?.name;
    expect(schemaName).toBe("wisedish_compact_result");
  });

  it("rewrites only the requested version on a swap", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      post(
        {
          dish: "chicken curry",
          transformationMode: "wisedish",
          servings: 1,
          swap: {
            tier: "balanced",
            intent: "replace",
            replacement: "red lentils",
            ingredient: { name: "Rice", amount: "1/2 cup" },
            version: {
              summary: "Balanced",
              originalProteinG: 20,
              totalProteinG: 40,
              cookTimeMinutes: 40,
              difficulty: "Medium",
              ingredients: [
                { name: "Chicken thigh", amount: "200g", note: "protein anchor" },
                { name: "Rice", amount: "1/2 cup", note: "starch" },
              ],
              steps: ["Cook the curry."],
              methodAdjustments: ["Sear", "Fold"],
              swapSummary: ["+ chicken"],
            },
          },
        },
        "https://wisedish.vercel.app",
        "10.0.0.3"
      )
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tier).toBe("balanced");
    expect(json.swapNote).toMatch(/lentil/);
    expect(json.version.name).toBe("Balanced");
    expect(json.version.totalProteinG).toBe(46);
    expect(json.version.proteinDeltaG).toBe(26); // recomputed, not the model's 999
    expect(json.version.caloriesPerServing).toBe(590);
    expect(json.version.ingredients.map((i: { name: string }) => i.name)).toContain("Rice + red lentils");

    const swapCall = calls.find((c) => c.response_format?.json_schema?.name === "wisedish_single_tier_swap");
    expect(swapCall).toBeTruthy();
    const user = swapCall!.messages.find((m) => m.role === "user")!.content;
    expect(user).toContain('"red lentils"');
    expect(user).toContain("Balanced version");
  });

  it("rejects malformed swaps without calling the model", async () => {
    const { POST } = await import("./route");
    const res = await POST(post({ dish: "chicken curry", swap: { tier: "balanced", intent: "replace" } }, "https://localhost", "10.0.0.4"));
    expect(res.status).toBe(400);
    expect(calls.some((c) => c.response_format?.json_schema?.name === "wisedish_single_tier_swap")).toBe(false);
  });

  it("does not grant CORS to other websites", async () => {
    const { POST } = await import("./route");
    const res = await POST(post({ dish: "" }, "https://evil.example", "10.0.0.5"));
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns a clean 400 for invalid JSON", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("https://wisedish.vercel.app/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.6" },
      body: "{not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
