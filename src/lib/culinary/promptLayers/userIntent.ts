import type { Mode } from "@/lib/culinary/systemPrompt";
import type { SliderValues } from "@/lib/wisedish/types";

export const CLOSE_MATCH_MIN_PROTEIN_DELTA = 8;

export const CLOSE_MATCH_RETRY_APPEND = `
CLOSE MATCH PROTEIN FLOOR (mandatory retry fix):
Close Match must deliver at least +${CLOSE_MATCH_MIN_PROTEIN_DELTA}g protein per serving vs baseline.
Increase the existing protein portion (up to +40%), swap to a higher-protein same-ingredient variant,
or add one normal grocery whole-food protein — never whey/powder/supplements in Close Match.
Re-output valid complete JSON with all three tiers fixed.
`.trim();

export type NormalizedSliders = SliderValues;

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Accept client sliders (0–10) or legacy API fields (0–100). */
export function normalizeSlidersFromRequest(raw: unknown): NormalizedSliders | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;

  if (typeof o.tasteIntegrity === "number") {
    return {
      tasteIntegrity: clampInt(o.tasteIntegrity, 0, 10),
      proteinBoost: clampInt(o.proteinBoost as number, 0, 10),
      pantryRealism: clampInt(o.pantryRealism as number, 0, 10),
    };
  }

  if (typeof o.flavorPreservation === "number") {
    return {
      tasteIntegrity: clampInt((o.flavorPreservation as number) / 10, 0, 10),
      proteinBoost: clampInt((o.proteinAggression as number) / 10, 0, 10),
      pantryRealism: clampInt((o.ingredientRealism as number) / 10, 0, 10),
    };
  }

  return undefined;
}

function sliderBand(value: number, low: string, mid: string, high: string): string {
  if (value <= 3) return low;
  if (value <= 6) return mid;
  return high;
}

function thirdTierLabel(mode: Mode): "Full Send" | "Fully Light" {
  return mode === "lean" ? "Fully Light" : "Full Send";
}

export function buildUserIntentBlock(input: {
  dish: string;
  mode: Mode;
  servings: number;
  sliders?: NormalizedSliders;
  addVeggies?: boolean;
}): string {
  const { dish, mode, servings, sliders, addVeggies } = input;
  const tier3 = thirdTierLabel(mode);

  const lines = [
    "USER INTENT (obey over generic defaults when they conflict):",
    "",
    `Dish: ${dish}`,
    `Mode: ${mode}`,
    `Servings: ${servings}`,
  ];

  if (sliders) {
    const { tasteIntegrity: t, proteinBoost: p, pantryRealism: r } = sliders;
    lines.push(
      "",
      "Fine-tune (0–10):",
      `- tasteIntegrity=${t}: ${sliderBand(t, "prioritize protein even if flavor shifts", "balanced trade-offs", "guest must not notice changes")}`,
      `- proteinBoost=${p}: ${sliderBand(p, "conservative protein gains", "standard upgrade", "push every tier toward max safe protein")}`,
      `- pantryRealism=${r}: ${sliderBand(r, "specialty items OK", "normal grocery store", "only typical supermarket staples")}`
    );
  }

  lines.push(
    "",
    `Add vegetables to all tiers: ${addVeggies ? "yes — fold in coherent veg without breaking starch/protein anchors" : "no"}`,
    "",
    "Tier contract for this session:",
    `- Tier 1 Close Match: ${mode === "lean" ? "one subtle fat swap or reduction; nearly identical" : `min +${CLOSE_MATCH_MIN_PROTEIN_DELTA}g protein; whole-food levers only; no whey/powder/supplements`}`,
    "- Tier 2 Balanced: 2–3 combined levers; one honest sentence on trade-off",
    `- Tier 3 ${tier3}: max push for this mode; name sensory cost when large`,
    "",
    "Output: transformationByComponent is the hero UX — user scans component slots before the full recipe."
  );

  return lines.join("\n");
}

export function bucketSliderForCache(v: number | undefined): number | null {
  if (v === undefined || !Number.isFinite(v)) return null;
  return Math.round(v / 2) * 2;
}

export function findCloseMatchProteinViolation(
  versions: Array<{ name: string; proteinDeltaG: number }>,
  mode: Mode
): string | null {
  if (mode !== "wisedish") return null;
  const close = versions.find((v) => v.name === "Close Match");
  if (!close) return null;
  if (close.proteinDeltaG < CLOSE_MATCH_MIN_PROTEIN_DELTA) {
    return `Close Match is +${close.proteinDeltaG}g protein; minimum is +${CLOSE_MATCH_MIN_PROTEIN_DELTA}g.`;
  }
  return null;
}

export function responseHasBlockerViolations(versions: Array<{ dilValidation: { violations: Array<{ severity: string }> } | null }>): boolean {
  for (const v of versions) {
    const blockers = v.dilValidation?.violations.filter((x) => x.severity === "blocker") ?? [];
    if (blockers.length > 0) return true;
  }
  return false;
}
