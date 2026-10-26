/**
 * Single-tier ingredient swap: the cook asks to change one ingredient in one version and only
 * that version is rewritten by the model (the other two stay as they are on the client).
 */

export const SWAP_INTENTS = ["higher-protein", "closer-to-original", "remove", "replace"] as const;
export type SwapIntent = (typeof SWAP_INTENTS)[number];

export const SWAP_TIERS = ["close-match", "balanced", "max-protein"] as const;
export type SwapTier = (typeof SWAP_TIERS)[number];

export type SwapVersionSnapshot = {
  summary: string;
  originalProteinG: number;
  totalProteinG: number;
  originalCaloriesPerServing: number | null;
  caloriesPerServing: number | null;
  cookTimeMinutes: number;
  difficulty: string;
  ingredients: { name: string; amount: string; note: string }[];
  steps: string[];
  methodAdjustments: string[];
  swapSummary: string[];
};

export type SwapRequest = {
  tier: SwapTier;
  ingredient: { name: string; amount: string };
  intent: SwapIntent;
  replacement: string | null;
  version: SwapVersionSnapshot;
};

const MAX_TEXT = 400;
const MAX_ROWS = 40;

function cleanText(v: unknown, max = MAX_TEXT): string {
  if (typeof v !== "string") return "";
  // Strip control characters; keep it to one tidy line-ish string.
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}

function cleanNumber(v: unknown, fallback: number | null): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function tierWireName(tier: SwapTier): "Close Match" | "Balanced" | "Full Send" {
  return tier === "close-match" ? "Close Match" : tier === "balanced" ? "Balanced" : "Full Send";
}

export function validateSwapRequest(raw: unknown): { ok: true; value: SwapRequest } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Missing swap details." };
  const r = raw as Record<string, unknown>;

  const tier = r.tier;
  if (typeof tier !== "string" || !(SWAP_TIERS as readonly string[]).includes(tier)) {
    return { ok: false, error: "Unknown recipe version." };
  }
  const intent = r.intent;
  if (typeof intent !== "string" || !(SWAP_INTENTS as readonly string[]).includes(intent)) {
    return { ok: false, error: "Unknown swap type." };
  }

  const ing = (r.ingredient ?? {}) as Record<string, unknown>;
  const ingredient = { name: cleanText(ing.name, 160), amount: cleanText(ing.amount, 80) };
  if (!ingredient.name) return { ok: false, error: "Missing ingredient to swap." };

  const replacement = cleanText(r.replacement, 80) || null;
  if (intent === "replace" && !replacement) return { ok: false, error: "Tell us what to use instead." };

  const v = (r.version ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(v.ingredients) ? v.ingredients.slice(0, MAX_ROWS) : [];
  const ingredients = rows
    .map((row) => {
      const o = (row ?? {}) as Record<string, unknown>;
      return { name: cleanText(o.name, 160), amount: cleanText(o.amount, 80), note: cleanText(o.note, 200) };
    })
    .filter((row) => row.name);
  if (ingredients.length === 0) return { ok: false, error: "Missing the current recipe." };

  const strings = (x: unknown, max: number) =>
    (Array.isArray(x) ? x : []).slice(0, max).map((s) => cleanText(s)).filter(Boolean);

  const originalProteinG = cleanNumber(v.originalProteinG, 0) ?? 0;
  const version: SwapVersionSnapshot = {
    summary: cleanText(v.summary),
    originalProteinG,
    totalProteinG: cleanNumber(v.totalProteinG, originalProteinG) ?? originalProteinG,
    originalCaloriesPerServing: cleanNumber(v.originalCaloriesPerServing, null),
    caloriesPerServing: cleanNumber(v.caloriesPerServing, null),
    cookTimeMinutes: cleanNumber(v.cookTimeMinutes, 35) ?? 35,
    difficulty: cleanText(v.difficulty, 20) || "Medium",
    ingredients,
    steps: strings(v.steps, MAX_ROWS),
    methodAdjustments: strings(v.methodAdjustments, 12),
    swapSummary: strings(v.swapSummary, 4),
  };

  return { ok: true, value: { tier: tier as SwapTier, intent: intent as SwapIntent, ingredient, replacement, version } };
}

function intentInstruction(req: SwapRequest): string {
  const target = `"${[req.ingredient.amount, req.ingredient.name].filter(Boolean).join(" ")}"`;
  switch (req.intent) {
    case "higher-protein":
      return `Replace ${target} with a higher-protein alternative that a home cook can buy and that fits this dish's identity. Pick the best specific ingredient yourself.`;
    case "closer-to-original":
      return `Make ${target} closer to what the traditional version of this dish uses (more authentic), accepting a smaller protein gain if needed.`;
    case "remove":
      return `Remove ${target} from this version and rebalance the rest so the dish still works.`;
    case "replace":
      return `Replace ${target} with "${req.replacement}" (the cook's choice — they may have it at home). Adjust amounts so it works; if it clearly cannot work in this dish, use the closest safe alternative and say so in swapNote.`;
  }
}

export function buildSwapUserMessage(dish: string, req: SwapRequest): string {
  const tierName = tierWireName(req.tier);
  const snapshot = {
    summary: req.version.summary,
    originalProteinG: req.version.originalProteinG,
    totalProteinG: req.version.totalProteinG,
    originalCaloriesPerServing: req.version.originalCaloriesPerServing,
    caloriesPerServing: req.version.caloriesPerServing,
    cookTimeMinutes: req.version.cookTimeMinutes,
    difficulty: req.version.difficulty,
    swapSummary: req.version.swapSummary,
    methodAdjustments: req.version.methodAdjustments,
    ingredients: req.version.ingredients,
    steps: req.version.steps,
  };
  return [
    `SINGLE-VERSION EDIT for "${dish}" — ${tierName} version.`,
    `Current ${tierName} recipe (JSON):`,
    JSON.stringify(snapshot),
    "",
    `Cook's request: ${intentInstruction(req)}`,
    "",
    "Rewrite ONLY this version and return the full updated version:",
    "- Change the requested ingredient line; touch other lines only when needed to keep the dish balanced.",
    "- Rewrite any step that mentions the old ingredient. Return complete steps in order (not just the changed ones).",
    `- Keep originalProteinG = ${req.version.originalProteinG}. Recompute proteinContributionG per line, totalProteinG and proteinDeltaG honestly.`,
    "- Estimate caloriesPerServing for the edited version and originalCaloriesPerServing for the original dish.",
    `- Keep the ${tierName} character (Close Match gentlest, Full Send strongest) and the dish identity rules from the system prompt.`,
    "- swapNote: one friendly sentence telling the cook what you changed.",
  ].join("\n");
}
