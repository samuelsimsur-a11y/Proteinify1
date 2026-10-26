import { describe, expect, it } from "vitest";
import { computeStats, proteinEquivalent, type CookEntry } from "./cookLog";

const DAY = 24 * 3600 * 1000;
// Wednesday 2026-10-21 12:00 local time
const NOW = new Date(2026, 9, 21, 12).getTime();

function entry(daysAgo: number, added: number, dish = "biryani", servings = 1): CookEntry {
  return {
    id: `${daysAgo}-${dish}`,
    dish,
    versionId: "balanced",
    versionLabel: "Balanced",
    proteinAddedG: added,
    totalProteinG: added + 20,
    servings,
    rating: 1,
    cookedAt: NOW - daysAgo * DAY,
  };
}

describe("computeStats", () => {
  it("sums protein added across servings and counts dishes", () => {
    const s = computeStats([entry(0, 30), entry(1, 20, "ramen", 2)], NOW);
    expect(s.totalAddedG).toBe(70);
    expect(s.dishesCooked).toBe(2);
    expect(s.uniqueDishes).toBe(2);
  });

  it("ignores negative protein changes in the bank", () => {
    expect(computeStats([entry(0, -5)], NOW).totalAddedG).toBe(0);
  });

  it("counts consecutive cooking weeks", () => {
    // This week, last week, two weeks ago, then a gap.
    const s = computeStats([entry(0, 10), entry(7, 10), entry(14, 10), entry(35, 10)], NOW);
    expect(s.weekStreak).toBe(3);
  });

  it("keeps the streak alive until the current week ends", () => {
    expect(computeStats([entry(7, 10), entry(14, 10)], NOW).weekStreak).toBe(2);
    expect(computeStats([entry(21, 10)], NOW).weekStreak).toBe(0);
  });

  it("reports milestones", () => {
    const s = computeStats([entry(0, 120)], NOW);
    expect(s.lastMilestoneG).toBe(100);
    expect(s.nextMilestoneG).toBe(250);
  });
});

describe("proteinEquivalent", () => {
  it("translates grams into eggs", () => {
    expect(proteinEquivalent(53)).toBe("≈ 9 eggs worth of protein");
    expect(proteinEquivalent(6)).toBe("≈ 1 egg worth of protein");
    expect(proteinEquivalent(3)).toBeNull();
  });
});
