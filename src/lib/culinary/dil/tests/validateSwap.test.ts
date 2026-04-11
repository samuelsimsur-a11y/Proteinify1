// src/lib/culinary/dil/tests/validateSwap.test.ts
// Run with: npx vitest run  OR  npx jest
// Covers all 10 golden regression cases.

import { describe, it, expect, beforeAll } from "vitest";
import { getDishByIdOrAlias, validateDILIntegrity } from "../loader";
import { validateSwap } from "../validator";
import goldenCases from "./golden-regression.json";
import type { SwapInput, UserGoal } from "../schemas";

beforeAll(() => {
  // Throws if any data inconsistency is found — catches regressions immediately
  validateDILIntegrity();
});

describe("DIL golden regression suite", () => {
  for (const tc of goldenCases) {
    it(tc.description, () => {
      const dish = getDishByIdOrAlias(tc.dishId);
      expect(dish).not.toBeNull();
      if (!dish) return;

      const events: unknown[] = [];
      const result = validateSwap(
        dish,
        tc.swaps as SwapInput[],
        {
          userGoal: tc.options?.userGoal as UserGoal | undefined,
          onEvent: (e) => events.push(e),
        }
      );

      // Always check isValid
      expect(result.isValid).toBe(tc.expected.isValid);

      // Violation count
      expect(result.violations.length).toBe(tc.expected.violationCount);

      // Blocked codes
      if (tc.expected.blockedCodes) {
        const blockers = result.violations
          .filter(v => v.severity === "blocker")
          .map(v => v.code);
        for (const code of tc.expected.blockedCodes) {
          expect(blockers).toContain(code);
        }
      }

      // Warned codes
      if (tc.expected.warnedCodes) {
        const warnings = result.violations
          .filter(v => v.severity === "warning")
          .map(v => v.code);
        for (const code of tc.expected.warnedCodes) {
          expect(warnings).toContain(code);
        }
      }

      // ViolationType
      if (tc.expected.violationType) {
        const types = result.violations.map(v => v.type);
        expect(types).toContain(tc.expected.violationType);
      }

      // Override flag
      if (tc.expected.allowOverride !== undefined) {
        const relevantViolation = result.violations[0];
        expect(relevantViolation?.allowOverride).toBe(tc.expected.allowOverride);
      }

      // Suggestions
      if (tc.expected.shouldSuggest) {
        for (const s of tc.expected.shouldSuggest) {
          const allAlts = result.violations.flatMap(v => [
            ...v.safeAlternatives,
            ...v.goalAlternatives,
          ]);
          expect(allAlts.some(a => a.toLowerCase().includes(s.toLowerCase()))).toBe(true);
        }
      }

      // Vegan goal alternatives check
      if (tc.expected.goalAlternativesShouldMentionVegan) {
        const goalAlts = result.violations.flatMap(v => v.goalAlternatives);
        expect(goalAlts.some(a => a.toLowerCase().includes("vegan") || a.toLowerCase().includes("mushroom"))).toBe(true);
      }

      // Telemetry event fired
      expect(events.length).toBe(1);
      const event = events[0] as { dishId: string; isValid: boolean };
      expect(event.dishId).toBe(tc.dishId);
      expect(event.isValid).toBe(tc.expected.isValid);
    });
  }
});
