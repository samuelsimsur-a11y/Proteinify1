/**
 * Post-generation prose checks driven by pre-classifier signals (dessert, vegan, etc.).
 */

import type { DishClassification } from "./classifier";
import type { BiryaniTierTextSource } from "./dil/biryaniTextGuard";
import { collectBiryaniTierText } from "./dil/biryaniTextGuard";

export type ClassificationTextHit = {
  code: string;
  severity: "blocker" | "warning";
  reason: string;
  matchedPhrase: string;
};

const DESSERT_HOT_WHEY = [
  /\bwhey\b[^.\n]{0,80}\b(batter|dough|mix|cake|brownie|cookie)\b/i,
  /\b(batter|dough|mix|cake|brownie|cookie)\b[^.\n]{0,80}\bwhey\b/i,
  /whey\s+isolate[^.\n]{0,40}\b(batter|mix)\b/i,
];

const VEGAN_ANIMAL = [
  /\bchicken\b/i,
  /\bbeef\b/i,
  /\bpork\b/i,
  /\blamb\b/i,
  /\bfish\b/i,
  /\bshrimp\b/i,
  /\begg\b/i,
  /\bwhey\b/i,
  /\bcasein\b/i,
  /\bcottage\s*cheese\b/i,
  /\bcream\s*cheese\b/i,
  /\bbutter\b/i,
  /\bghee\b/i,
  /\bhoney\b/i,
  /\bgelatin\b/i,
];

export function checkClassificationTierText(
  classification: DishClassification,
  source: BiryaniTierTextSource
): ClassificationTextHit[] {
  const haystack = collectBiryaniTierText(source);
  const hits: ClassificationTextHit[] = [];

  if (classification.dish_type === "dessert") {
    for (const pattern of DESSERT_HOT_WHEY) {
      const match = haystack.match(pattern);
      if (match) {
        hits.push({
          code: "dessert-whey-in-hot-mix",
          severity: "blocker",
          reason: "Whey isolate in hot baked batter collapses dessert structure — use casein, egg white, or Greek yogurt.",
          matchedPhrase: match[0],
        });
        break;
      }
    }
  }

  if (classification.dietary_flags.includes("vegan")) {
    for (const pattern of VEGAN_ANIMAL) {
      const match = haystack.match(pattern);
      if (match) {
        hits.push({
          code: "vegan-animal-product",
          severity: "blocker",
          reason: "Animal-derived ingredient conflicts with vegan classification.",
          matchedPhrase: match[0],
        });
        break;
      }
    }
  }

  if (classification.dish_components.length > 1 && classification.protein_component) {
    const baseHints = classification.dish_components
      .filter((c) => !c.toLowerCase().includes("protein"))
      .join(" ");
    if (baseHints.length > 0) {
      const powderInBase = haystack.match(
        /(protein\s+powder|whey\s+isolate|pea\s+protein)[^.\n]{0,60}(rice|base|jollof|grain)/i
      );
      if (powderInBase) {
        hits.push({
          code: "protein-powder-in-base-component",
          severity: "blocker",
          reason: `Boost ${classification.protein_component} — do not add protein powder to the base component.`,
          matchedPhrase: powderInBase[0],
        });
      }
    }
  }

  return hits;
}

export function hasClassificationTextBlockers(hits: ClassificationTextHit[]): boolean {
  return hits.some((h) => h.severity === "blocker");
}

export function classificationHitsToValidationResult(
  hits: ClassificationTextHit[]
): import("./dil/schemas").ValidationResult | null {
  if (hits.length === 0) return null;
  const violations = hits.map((h) => ({
    code: h.code,
    type: "confusionviolation" as const,
    severity: h.severity,
    reason: `${h.reason} (matched: "${h.matchedPhrase}")`,
    educationalContext: "Regenerate using pre-classification rules (dessert physics, vegan constraints, component boundaries).",
    safeAlternatives: [] as string[],
    goalAlternatives: [] as string[],
    allowOverride: h.severity === "warning",
  }));
  return {
    isValid: violations.every((v) => v.severity !== "blocker"),
    violations,
    suggestions: [],
  };
}

export const CLASSIFICATION_GENERATION_RETRY_USER_APPEND = `
CRITICAL — pre-classification rules were violated in recipe prose:
- Desserts: no whey or protein powder in batters/doughs that bake or steam hot; use casein, egg white, almond flour, or cold-folded Greek yogurt.
- Vegan dishes: no meat, fish, eggs, dairy, whey, casein, honey, or gelatin in any tier.
- Multi-component dishes: boost the identified protein component only — never add protein powder to the base (e.g. do not spike jollof rice with powder).
Regenerate all tiers with compliant ingredients and swapSummary pills.
`.trim();
