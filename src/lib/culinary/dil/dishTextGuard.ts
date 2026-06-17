/**
 * Dish-specific prose guards — catches forbidden swaps in tier text when appliedSwapCodes is empty.
 * Biryani retains its dedicated module; other catalogued dishes use shared rule tables here.
 */

import type { ValidationResult, ViolationType } from "./schemas";
import {
  biryaniTextHitsToValidationResult,
  buildDilConsistencyWarning as buildBiryaniConsistencyWarning,
  checkBiryaniTierText,
  hasBiryaniTextBlockers,
  type BiryaniTierTextSource,
} from "./biryaniTextGuard";

export type DishTierTextSource = BiryaniTierTextSource;

export type DishTextHit = {
  code: string;
  severity: "blocker" | "warning";
  reason: string;
  matchedPhrase: string;
  violationType: ViolationType;
};

type TextRule = {
  code: string;
  severity: "blocker" | "warning";
  reason: string;
  violationType: ViolationType;
  patterns: RegExp[];
  allowOverride: boolean;
  /** If set, only run on these tier names */
  tiers?: Array<"Close Match" | "Balanced" | "Full Send">;
};

const DISH_TEXT_RULES: Record<string, TextRule[]> = {
  "jerk-chicken": [
    {
      code: "yogurt-marinade-amplification",
      severity: "blocker",
      reason: "Jerk is dry-rub grill — yogurt marinade imports tandoori grammar.",
      violationType: "confusionviolation",
      allowOverride: false,
      patterns: [/yogurt/i, /\bcurd\b/i, /buttermilk\s*marinade/i],
    },
    {
      code: "paneer-addition",
      severity: "blocker",
      reason: "Paneer is not Caribbean protein grammar.",
      violationType: "zoneviolation",
      allowOverride: false,
      patterns: [/paneer/i],
    },
    {
      code: "bone-broth-substitute",
      severity: "warning",
      reason: "Bone broth baste changes dry-heat jerk identity.",
      violationType: "portabilityviolation",
      allowOverride: true,
      patterns: [/bone\s*broth/i, /\bbaste\b.*\bbroth/i],
    },
  ],
  "pho-bo": [
    {
      code: "yogurt-marinade-amplification",
      severity: "blocker",
      reason: "Dairy has no place in pho broth grammar.",
      violationType: "confusionviolation",
      allowOverride: false,
      patterns: [/yogurt/i, /cream\s*cheese/i, /cottage\s*cheese/i, /\bsour\s*cream\b/i],
    },
    {
      code: "whey-in-hot-broth",
      severity: "blocker",
      reason: "Protein powder in hot pho broth breaks clarity and identity.",
      violationType: "flavorarchviolation",
      allowOverride: false,
      patterns: [/whey/i, /protein\s*powder/i],
    },
  ],
  "pad-thai": [
    {
      code: "edamame-pad-thai",
      severity: "blocker",
      reason: "Edamame fights pad thai tamarind–fish sauce balance.",
      violationType: "flavorarchviolation",
      allowOverride: false,
      patterns: [/edamame/i],
    },
    {
      code: "paneer-addition",
      severity: "blocker",
      reason: "Paneer is not Thai stir-fry grammar.",
      violationType: "zoneviolation",
      allowOverride: false,
      patterns: [/paneer/i],
    },
    {
      code: "bone-broth-substitute",
      severity: "blocker",
      reason: "Broth flood turns pad thai into soup.",
      violationType: "portabilityviolation",
      allowOverride: false,
      patterns: [/bone\s*broth/i, /stock\s*flood/i, /simmer\s*noodles\s*in\s*broth/i],
    },
  ],
  falafel: [
    {
      code: "egg-in-falafel-mix",
      severity: "blocker",
      reason: "Egg in falafel mixture breaks traditional vegan identity.",
      violationType: "dietaryviolation",
      allowOverride: false,
      patterns: [/\begg\b/i, /\beggs\b/i],
    },
    {
      code: "whey-in-falafel-paste",
      severity: "blocker",
      reason: "Protein powder in falafel paste destroys crisp fry shell.",
      violationType: "physicsviolation",
      allowOverride: false,
      patterns: [/whey/i, /protein\s*powder/i],
    },
    {
      code: "cottage-cheese-falafel",
      severity: "blocker",
      reason: "Cottage cheese in falafel is not valid Middle Eastern grammar.",
      violationType: "flavorarchviolation",
      allowOverride: false,
      patterns: [/cottage\s*cheese/i, /cream\s*cheese/i],
    },
  ],
};

function collectText(source: DishTierTextSource): string {
  const parts: string[] = [
    source.summary,
    ...source.swapSummary,
    ...source.transformationByComponent.protein,
    ...source.transformationByComponent.carbBase,
    ...source.transformationByComponent.sauceBroth,
    ...source.transformationByComponent.fat,
    ...source.transformationByComponent.toppings,
    ...source.methodAdjustments,
    ...source.ingredients.map((i) => `${i.name} ${i.note ?? ""}`),
    ...source.instructions.map((i) => i.step),
  ];
  return parts.join("\n");
}

function runRules(rules: TextRule[], source: DishTierTextSource, tierName: string): DishTextHit[] {
  const haystack = collectText(source);
  const hits: DishTextHit[] = [];
  for (const rule of rules) {
    if (rule.tiers && !rule.tiers.includes(tierName as "Close Match" | "Balanced" | "Full Send")) {
      continue;
    }
    for (const pattern of rule.patterns) {
      const m = haystack.match(pattern);
      if (m) {
        hits.push({
          code: rule.code,
          severity: rule.severity,
          reason: rule.reason,
          matchedPhrase: m[0],
          violationType: rule.violationType,
        });
        break;
      }
    }
  }
  return hits;
}

export function checkDishTierText(
  dishId: string,
  source: DishTierTextSource,
  tierName: string
): DishTextHit[] {
  if (dishId === "biryani") {
    return checkBiryaniTierText(source, tierName as "Close Match" | "Balanced" | "Full Send");
  }
  const rules = DISH_TEXT_RULES[dishId];
  if (!rules) return [];
  return runRules(rules, source, tierName);
}

export function dishTextHitsToValidationResult(hits: DishTextHit[]): ValidationResult | null {
  if (hits.length === 0) return null;
  return {
    isValid: !hits.some((h) => h.severity === "blocker"),
    violations: hits.map((h) => ({
      code: h.code,
      type: h.violationType,
      severity: h.severity,
      reason: h.reason,
      educationalContext: h.reason,
      safeAlternatives: [],
      goalAlternatives: [],
      allowOverride: h.severity === "warning",
    })),
    suggestions: [],
  };
}

export function buildDishConsistencyWarning(tierName: string, hits: DishTextHit[]): string | null {
  if (hits.length === 0) return null;
  const codes = hits.map((h) => h.code).join(", ");
  return `${tierName}: conflicts with dish identity rules (${codes}).`;
}

/** Unified entry for route annotation — handles biryani + catalogued dishes. */
export function checkCataloguedDishTierText(
  dishId: string,
  source: DishTierTextSource,
  tierName: string
): { hits: DishTextHit[]; validation: ValidationResult | null; consistencyWarning: string | null } {
  if (dishId === "biryani") {
    const hits = checkBiryaniTierText(source, tierName as "Close Match" | "Balanced" | "Full Send");
    return {
      hits,
      validation: biryaniTextHitsToValidationResult(hits),
      consistencyWarning: buildBiryaniConsistencyWarning(tierName, hits),
    };
  }
  const hits = checkDishTierText(dishId, source, tierName);
  return {
    hits,
    validation: dishTextHitsToValidationResult(hits),
    consistencyWarning: buildDishConsistencyWarning(tierName, hits),
  };
}

export function hasCataloguedDishTextBlockers(dishId: string, hits: DishTextHit[]): boolean {
  if (dishId === "biryani") {
    return hasBiryaniTextBlockers(hits as Parameters<typeof hasBiryaniTextBlockers>[0]);
  }
  return hits.some((h) => h.severity === "blocker");
}

export const DISH_TEXT_RETRY_APPEND: Record<string, string> = {
  "jerk-chicken":
    "JERK RETRY: Remove all yogurt/curd marinade language. Jerk is dry-rub + grill/smoke only. Boost protein via larger chicken portions or extra rub-coated pieces — not tandoori or paneer logic.",
  "pho-bo":
    "PHO RETRY: No dairy, whey, or cottage cheese in broth. Protein via extra thin-sliced beef or tendon — broth stays clear aromatic beef, not enriched with powder.",
  "pad-thai":
    "PAD THAI RETRY: No edamame, paneer, or broth-flood. Protein via extra shrimp/chicken or pressed fried tofu in the wok pass. Keep tamarind–fish sauce balance.",
  falafel:
    "FALAFEL RETRY: Mixture stays vegan — no egg, whey, or cottage cheese in the paste. Protein via slightly larger portions of the same chickpea/fava mix or tahini on the side.",
};

export function dishTextRetryAppend(dishId: string): string | null {
  return DISH_TEXT_RETRY_APPEND[dishId] ?? null;
}
