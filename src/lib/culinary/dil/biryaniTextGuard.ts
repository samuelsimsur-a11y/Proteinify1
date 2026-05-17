/**
 * Server-side biryani prose guard — catches forbidden swaps in tier text when
 * appliedSwapCodes is empty (LLM slop that bypasses validateSwap).
 */

import type { ValidationResult, ViolationType } from "./schemas";

export type BiryaniTierTextSource = {
  summary: string;
  swapSummary: string[];
  transformationByComponent: {
    protein: string[];
    carbBase: string[];
    sauceBroth: string[];
    fat: string[];
    toppings: string[];
  };
  methodAdjustments: string[];
  ingredients: Array<{ name: string; note?: string }>;
  instructions: Array<{ step: string }>;
};

export type BiryaniTextHit = {
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
};

const BIRYANI_TEXT_RULES: TextRule[] = [
  {
    code: "cottage-cheese-biryani-marinade",
    severity: "blocker",
    reason: "Cottage cheese in biryani marinade is not valid dum biryani grammar.",
    violationType: "flavorarchviolation",
    allowOverride: false,
    patterns: [/cottage\s*cheese/i, /cream\s*cheese/i, /ricotta/i],
  },
  {
    code: "lentil-rice-dominant-biryani",
    severity: "blocker",
    reason: "Dominant lentil–rice blend changes basmati grain identity.",
    violationType: "structuralviolation",
    allowOverride: false,
    patterns: [
      /lentil[\s-]*(and\s*)?(basmati\s*)?rice/i,
      /rice[\s-]*(and\s*)?lentil/i,
      /lentil[\s-]*rice\s*blend/i,
      /\d+\s*%\s*lentil/i,
      /50\s*\/\s*50.*lentil/i,
      /lentils?\s+blended\s+with\s+rice/i,
      /cooked\s+lentils?\s+(mixed|blended|through)\s+.*rice/i,
      /khichdi/i,
    ],
  },
  {
    code: "cauliflower-rice-swap",
    severity: "blocker",
    reason: "Cauliflower rice collapses grain separation under dum steam.",
    violationType: "physicsviolation",
    allowOverride: false,
    patterns: [/cauliflower\s*rice/i],
  },
  {
    code: "soya-chunks-addition",
    severity: "blocker",
    reason: "Soy chunks in the dum vessel break layered biryani physics.",
    violationType: "structuralviolation",
    allowOverride: false,
    patterns: [/(?:soya|soy)\s*chunks?/i, /\bTVP\b/],
  },
  {
    code: "orphan-whey-biryani-step",
    severity: "blocker",
    reason: "Whey belongs whisked into cold yogurt before marination, not added after cooking.",
    violationType: "confusionviolation",
    allowOverride: false,
    patterns: [
      /whey.*after\s+(?:the\s+)?(?:cook|dum|layer)/i,
      /mix\s+whey.*after/i,
      /after\s+cooking.*whey/i,
      /after\s+dum.*whey/i,
    ],
  },
  {
    code: "soft-boiled-egg-alongside",
    severity: "warning",
    reason: "Soft-boiled egg garnish on meat biryani imports non-South-Asian presentation logic.",
    violationType: "dietaryviolation",
    allowOverride: true,
    patterns: [/soft[\s-]*boiled\s+egg/i, /jammy\s+egg/i],
  },
];

const DEFAULT_SUGGESTIONS = [
  "konjac rice blend up to 30% — drain thoroughly before layering",
  "increase original meat portion by 20–30%",
  "bone broth only as rice parboil liquid",
  "whey isolate whisked into cold yogurt before marinating",
];

export function collectBiryaniTierText(source: BiryaniTierTextSource): string {
  const parts: string[] = [
    source.summary,
    ...source.swapSummary,
    ...source.transformationByComponent.protein,
    ...source.transformationByComponent.carbBase,
    ...source.transformationByComponent.sauceBroth,
    ...source.transformationByComponent.fat,
    ...source.transformationByComponent.toppings,
    ...source.methodAdjustments,
    ...source.ingredients.map((i) => `${i.name} ${i.note ?? ""}`.trim()),
    ...source.instructions.map((i) => i.step),
  ];
  return parts.filter(Boolean).join("\n");
}

export function checkBiryaniTierText(source: BiryaniTierTextSource): BiryaniTextHit[] {
  const haystack = collectBiryaniTierText(source);
  const hits: BiryaniTextHit[] = [];

  for (const rule of BIRYANI_TEXT_RULES) {
    for (const pattern of rule.patterns) {
      const match = haystack.match(pattern);
      if (match) {
        hits.push({
          code: rule.code,
          severity: rule.severity,
          reason: rule.reason,
          matchedPhrase: match[0],
          violationType: rule.violationType,
        });
        break;
      }
    }
  }

  return hits;
}

export function biryaniTextHitsToValidationResult(hits: BiryaniTextHit[]): ValidationResult | null {
  if (hits.length === 0) return null;

  const violations = hits.map((h) => {
    const rule = BIRYANI_TEXT_RULES.find((r) => r.code === h.code);
    return {
      code: h.code,
      type: h.violationType,
      severity: h.severity,
      reason: `${h.reason} (matched: "${h.matchedPhrase}")`,
      educationalContext:
        "This was detected in recipe prose even though appliedSwapCodes was empty. Regenerate using konjac ≤30%, bone-broth parboil only, and yogurt+whey marinade discipline.",
      safeAlternatives: DEFAULT_SUGGESTIONS,
      goalAlternatives: [] as string[],
      allowOverride: rule?.allowOverride ?? h.severity === "warning",
    };
  });

  return {
    isValid: violations.every((v) => v.severity !== "blocker"),
    violations,
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

export function mergeValidationResults(
  swapResult: ValidationResult | null,
  textResult: ValidationResult | null
): ValidationResult | null {
  if (!swapResult && !textResult) return null;
  if (!swapResult) return textResult;
  if (!textResult) return swapResult;

  const violations = [...swapResult.violations, ...textResult.violations];
  const suggestions = [...new Set([...swapResult.suggestions, ...textResult.suggestions])];

  return {
    isValid: swapResult.isValid && textResult.isValid,
    violations,
    suggestions,
  };
}

export function buildDilConsistencyWarning(
  tierName: string,
  hits: BiryaniTextHit[]
): string | null {
  const blockers = hits.filter((h) => h.severity === "blocker");
  if (blockers.length === 0) return null;
  const codes = [...new Set(blockers.map((b) => b.code))].join(", ");
  return `${tierName}: recipe text conflicts with biryani DIL (${codes}). Prefer konjac ≤30% (drained), bone-broth rice parboil only, and no cottage cheese or lentil-heavy rice.`;
}

export function hasBiryaniTextBlockers(hits: BiryaniTextHit[]): boolean {
  return hits.some((h) => h.severity === "blocker");
}

export const BIRYANI_GENERATION_RETRY_USER_APPEND = `
CRITICAL CORRECTION — your previous JSON violated dum biryani rules detected in prose:
- Remove cottage cheese, ricotta, and cream cheese from marinade or layers.
- Do NOT use lentil-heavy rice blends (no 40–50% lentils, no khichdi-style grain, no "lentil rice blend" as the carb story).
- Starch hack for Balanced/Full Send: konjac rice substitute up to 30% of rice dry weight with basmati, rinsed, boiled briefly, squeezed bone-dry — NOT lentil rice.
- Bone broth/stock ONLY as the liquid for parboiling rice before layering — never poured over dum layers.
- Whey only whisked into COLD yogurt before the meat marinates — never a separate "add whey after cooking/dum" step.
Regenerate all tiers with appliedSwapCodes where relevant and coherent ingredient/instruction text.
`.trim();
