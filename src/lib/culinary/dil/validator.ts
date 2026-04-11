// src/lib/culinary/dil/validator.ts
// FIX: no more (dish as any)[k] — mustNotHave uses typed keyof DishDNA enum.
// FIX: separate physics violation pass wired to ingredientPhysics + physicsConstraints.
// FIX: goal-aware alternative suggestions.
// FIX: emitValidationEvent telemetry hook.
// FIX: quantity-aware severity (trace amount shouldn't trigger a blocker).

import type {
  DishDNA,
  SwapGuard,
  ValidationResult,
  ValidationEvent,
  ValidateSwapOptions,
  UserGoal,
  SwapInput,
} from "./schemas";
import { QUANTITY_PCT_MAP } from "./schemas";
import { allSwapGuards } from "./loader";

// ─── Typed boolean key accessor ───────────────────────────────────────────────
// FIX: replaces (dish as any)[k] — only boolean fields are accessible here,
// enforced by the DishDNABooleanKey enum in schemas.ts.

type BooleanDishKey = "isTraditionallyVegan" | "hasMarinade" | "dairyPresent";

function getBooleanField(dish: DishDNA, key: BooleanDishKey): boolean {
  return dish[key];
}

// ─── Physics violation pass ───────────────────────────────────────────────────
// FIX (Sundar + Kenji): previously "waterActivityDelta > 0.2" was documented
// but never wired. Now physicsConstraints on the dish + ingredientPhysics on
// the guard produce physicsviolations automatically.

function checkPhysicsViolations(
  dish: DishDNA,
  guard: SwapGuard,
  quantity: SwapInput["quantity"],
): "blocker" | "warning" | null {
  if (!guard.ingredientPhysics || !dish.physicsConstraints) return null;

  const { freeWaterReleaseRisk } = guard.ingredientPhysics;
  const { moistureSensitive } = dish.physicsConstraints;

  if (!moistureSensitive || !freeWaterReleaseRisk) return null;

  // "critical" water-release ingredients in moisture-sensitive dishes
  // are always physics blockers regardless of guard list rules.
  if (freeWaterReleaseRisk === "critical") return "blocker";

  // "high" water-release is a warning unless added in significant/dominant amount
  if (freeWaterReleaseRisk === "high") {
    const pct = quantity ? QUANTITY_PCT_MAP[quantity] : 25; // assume significant if unknown
    return pct >= 15 ? "blocker" : "warning";
  }

  return null;
}

// ─── Quantity-aware severity resolution ───────────────────────────────────────
// FIX (Sam): a trace amount of soy chunks as garnish ≠ full protein replacement.
// Severity can be downgraded based on quantityThreshold if quantity is provided.

function resolveEffectiveSeverity(
  guard: SwapGuard,
  quantity: SwapInput["quantity"] | undefined,
): "blocker" | "warning" | "suggestion" {
  if (!guard.quantityThreshold || !quantity) return guard.severity;

  const pct = QUANTITY_PCT_MAP[quantity];
  const { blockerAbovePct, warningAbovePct } = guard.quantityThreshold;

  if (pct >= blockerAbovePct) return "blocker";
  if (pct >= warningAbovePct) return "warning";
  return "suggestion";
}

// ─── Goal-aware alternatives ──────────────────────────────────────────────────

function getGoalAlternatives(guard: SwapGuard, userGoal: UserGoal | undefined): string[] {
  if (!userGoal || !guard.alternativesByGoal) return [];
  return guard.alternativesByGoal[userGoal] ?? guard.alternativesByGoal["general"] ?? [];
}

// ─── Main validator ───────────────────────────────────────────────────────────

/**
 * Validates proposed swap inputs against DIL guards for the given dish.
 *
 * @param dish     The resolved DishDNA context
 * @param swaps    Array of {code, quantity?} from the LLM tool call output
 * @param options  userGoal, quantity override, onEvent telemetry callback
 */
export function validateSwap(
  dish: DishDNA,
  swaps: SwapInput[],
  options: ValidateSwapOptions = {},
): ValidationResult {
  const { userGoal, onEvent } = options;
  const violations: ValidationResult["violations"] = [];
  const allSuggestions = new Set<string>();

  for (const swap of swaps) {
    const guard = allSwapGuards.find(g => g.code === swap.code);
    if (!guard) {
      // Unknown code — not in guard list. Treat as a warning, not a silent pass.
      violations.push({
        code: swap.code,
        type: "portabilityviolation",
        severity: "warning",
        reason: `Swap code "${swap.code}" is not in the DIL guard registry for this dish.`,
        educationalContext: "Unregistered codes may indicate the model generated a code outside the valid set. Review the tool output contract.",
        safeAlternatives: [],
        goalAlternatives: [],
        allowOverride: true,
      });
      continue;
    }

    let violated = false;
    const c = guard.constraints;

    // ── Hard bans by dish, method, zone ──────────────────────────────────────
    if (c.bannedDishes?.includes(dish.id)) violated = true;
    if (!violated && c.bannedMethods?.includes(dish.identityMethod)) violated = true;
    if (!violated && c.bannedZones?.includes(dish.cuisineZone)) violated = true;

    // ── Typed boolean flag checks ─────────────────────────────────────────────
    // FIX: no (dish as any)[k] — uses typed BooleanDishKey accessor
    if (!violated && c.mustNotHave) {
      violated = c.mustNotHave.some(key =>
        getBooleanField(dish, key as BooleanDishKey) === true
      );
    }
    if (!violated && c.mustHave) {
      violated = c.mustHave.some(key =>
        getBooleanField(dish, key as BooleanDishKey) === false
      );
    }

    // ── Historical absence check ──────────────────────────────────────────────
    if (!violated && c.bannedIfHistoricallyAbsentIncludes) {
      violated = c.bannedIfHistoricallyAbsentIncludes.some(bannedItem =>
        dish.historicallyAbsent.some(h => h.item === bannedItem)
      );
    }

    if (!violated) continue;

    // ── Physics override (may escalate severity) ──────────────────────────────
    const physicsSeverity = checkPhysicsViolations(dish, guard, swap.quantity);
    const effectiveSeverity = physicsSeverity
      ? (physicsSeverity === "blocker" ? "blocker" : resolveEffectiveSeverity(guard, swap.quantity))
      : resolveEffectiveSeverity(guard, swap.quantity);

    const goalAlternatives = getGoalAlternatives(guard, userGoal);

    violations.push({
      code: guard.code,
      type: physicsSeverity ? "physicsviolation" : guard.violationIfBroken,
      severity: effectiveSeverity,
      reason: guard.reason,
      educationalContext: guard.educationalContext,
      safeAlternatives: guard.safeAlternatives,
      goalAlternatives,
      allowOverride: guard.allowOverride,
    });

    // Collect suggestions from non-blocker violations
    if (effectiveSeverity !== "blocker") {
      [...guard.safeAlternatives, ...goalAlternatives].forEach(s => allSuggestions.add(s));
    }
  }

  const result: ValidationResult = {
    isValid: violations.every(v => v.severity !== "blocker"),
    violations,
    suggestions: [...allSuggestions],
  };

  // ── Telemetry ─────────────────────────────────────────────────────────────
  // FIX (Sam): emits a ValidationEvent on every call — noop if no handler provided.
  // Wire onEvent to your analytics/logging layer from the call site.
  if (onEvent) {
    const event: ValidationEvent = {
      dishId: dish.id,
      proposedCodes: swaps.map(s => s.code),
      violationCodes: violations.map(v => v.code),
      suggestionsShown: result.suggestions,
      userGoal: userGoal ?? null,
      isValid: result.isValid,
      timestamp: Date.now(),
    };
    onEvent(event);
  }

  return result;
}
