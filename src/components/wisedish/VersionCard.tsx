"use client";

import type { RecipeDifficulty, RecipeVersion, TransformationMode } from "@/lib/wisedish/types";
import type { SwapIntent } from "@/lib/wisedish/clientGenerate";
import { displayVersionLabel } from "@/lib/wisedish/displayVersionLabel";
import { scaleIngredientAmount } from "@/lib/wisedish/scaleQuantity";
import { proteinEquivalent } from "@/lib/cookLog";
import IngredientList from "./IngredientList";
import CopyRecipeButton from "./CopyRecipeButton";
import ShareButton from "./ShareButton";
import CookedButton from "./CookedButton";
import FeedbackButton from "./FeedbackButton";
import { humanizeIngredientDisplay } from "./humanizeIngredientDisplay";
import { COMPONENT_SLOTS, getSlotLines } from "./transformationUiConstants";
import { useEffect, useMemo, useRef, useState } from "react";

function difficultyBadgeClass(d: RecipeDifficulty): string {
  switch (d) {
    case "Easy":
      return "border-emerald-200/90 bg-emerald-50 text-emerald-900";
    case "Medium":
      return "border-amber-200/90 bg-amber-50 text-amber-950";
    case "Takes effort":
      return "border-orange-200/90 bg-orange-50 text-orange-950";
  }
}

/** Tier "rarity" accents: Close Match calm, Balanced cool, Full Send gold. */
const TIER_ACCENT: Record<RecipeVersion["id"], string> = {
  "close-match": "border-l-[color:var(--tier-close)]",
  balanced: "border-l-[color:var(--tier-balanced)]",
  "max-protein": "border-l-[color:var(--tier-full)]",
};

type Props = {
  dish: string;
  transformationMode: TransformationMode;
  servings: 1 | 2 | 4 | 6 | 8;
  previewServings: number;
  resultId: string;
  version: RecipeVersion;
  expanded: boolean;
  onToggleExpand: () => void;
  isLast: boolean;
  isRegenerating?: boolean;
  swapDisabled?: boolean;
  /** Shown after a successful ingredient swap on this version. */
  swapNote?: string;
  /** Stagger for the protein count-up when results land. */
  revealDelayMs?: number;
  onSwapIngredient: (
    versionId: RecipeVersion["id"],
    ingredientId: string,
    request: { intent: SwapIntent; replacement?: string }
  ) => void;
};

const changedBubbleClass =
  "rounded-2xl border-2 border-[color:var(--accent-forest)]/35 bg-gradient-to-br from-[color:var(--accent-forest-light)] via-[color:var(--surface-card)] to-[color:var(--surface-offset)] p-4 shadow-md ring-1 ring-[color:rgba(0,0,0,0.05)]";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * The "reward reveal": counts up from the original protein when the card first appears, and from
 * the previous total when a swap changes it.
 */
function useCountUp(from: number, to: number, delayMs: number): number {
  const [value, setValue] = useState(from);
  const shownRef = useRef(from);
  useEffect(() => {
    const start = shownRef.current;
    if (prefersReducedMotion() || start === to) {
      shownRef.current = to;
      const t = window.setTimeout(() => setValue(to), 0);
      return () => window.clearTimeout(t);
    }
    let raf = 0;
    const duration = 900;
    const startAt = performance.now() + delayMs;
    const step = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - startAt) / duration));
      const eased = 1 - Math.pow(1 - p, 3);
      const next = Math.round(start + (to - start) * eased);
      shownRef.current = next;
      setValue(next);
      if (p < 1) raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [to, delayMs]);
  return value;
}

export default function VersionCard({
  dish,
  transformationMode,
  servings,
  previewServings,
  resultId,
  version,
  expanded,
  onToggleExpand,
  isLast,
  isRegenerating,
  swapDisabled,
  swapNote,
  revealDelayMs = 0,
  onSwapIngredient,
}: Props) {
  const scaleFactor = Math.max(0.01, previewServings / servings);
  const scaleAmount = (amount: string): string => scaleIngredientAmount(amount, servings, previewServings);

  const [showCustomizeIngredients, setShowCustomizeIngredients] = useState(false);
  const [showUnchangedSlots, setShowUnchangedSlots] = useState(false);
  const [showFullRecipe, setShowFullRecipe] = useState(false);

  const toggleExpand = () => {
    if (!expanded) {
      // Open fresh every time instead of remembering sub-panels from last time.
      setShowCustomizeIngredients(false);
      setShowUnchangedSlots(false);
      setShowFullRecipe(false);
    }
    onToggleExpand();
  };

  const { changedSlots, unchangedSlots } = useMemo(() => {
    const changed: typeof COMPONENT_SLOTS = [];
    const unchanged: typeof COMPONENT_SLOTS = [];
    for (const slot of COMPONENT_SLOTS) {
      const lines = getSlotLines(version.transformationByComponent, slot.key);
      if (lines.length > 0) changed.push(slot);
      else unchanged.push(slot);
    }
    return { changedSlots: changed, unchangedSlots: unchanged };
  }, [version.transformationByComponent]);

  const totalProtein = Math.round(version.totalProteinG ?? version.macros.p);
  const originalProtein = Math.max(0, Math.round(totalProtein - version.macros.d));
  const computedDelta = totalProtein - originalProtein;
  const animatedTotal = useCountUp(originalProtein, totalProtein, revealDelayMs);
  const scaledOriginalProtein = Math.round(originalProtein * scaleFactor);
  const scaledDelta = Math.round(computedDelta * scaleFactor);
  const scaledTotalProtein = Math.round(totalProtein * scaleFactor);
  const showMealPrepNote = servings > 1 && !!version.mealPrepNote;
  const equivalent = computedDelta > 0 ? proteinEquivalent(computedDelta) : null;
  const label = displayVersionLabel(version, transformationMode);

  const kcalBefore = version.calories?.before ?? null;
  const kcalAfter = version.calories?.after ?? null;
  const kcalDelta = kcalBefore !== null && kcalAfter !== null ? kcalAfter - kcalBefore : null;

  return (
    <div
      className={`relative overflow-hidden border-l-4 ${TIER_ACCENT[version.id]} ${isLast ? "" : "border-b border-b-[color:var(--divider)]"}`}
    >
      {isRegenerating ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[color:rgba(0,0,0,0.06)] backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-full border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-4 py-2 text-xs font-semibold text-[color:var(--text-muted)] shadow-sm">
            <span className="pf-spinner !h-4 !w-4" aria-hidden />
            Swapping and rebalancing this version…
          </div>
        </div>
      ) : null}

      <div className="px-[18px] py-4 transition-colors hover:bg-[color:var(--surface-offset)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-lg font-bold text-[color:var(--text-primary)]">{label}</span>
              <span className="text-xs font-medium tabular-nums text-[color:var(--text-muted)]">
                ~{version.cookTimeMinutes} min
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none ${difficultyBadgeClass(version.difficulty)}`}
              >
                {version.difficulty}
              </span>
            </div>
            {version.summary ? (
              <div className="mt-0.5 line-clamp-2 text-sm text-[color:var(--text-muted)]">{version.summary}</div>
            ) : null}
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-xs text-[color:var(--text-muted)]">Protein per serving</span>
              <span className="font-display text-base font-bold tabular-nums text-[color:var(--text-primary)]">
                {originalProtein}g → {animatedTotal}g
              </span>
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                  computedDelta >= 0
                    ? "bg-[color:var(--accent-forest-light)] text-[color:var(--accent-forest)]"
                    : "bg-[color:var(--surface-offset)] text-[color:var(--text-muted)]",
                ].join(" ")}
              >
                {computedDelta >= 0 ? `+${computedDelta}g` : `${computedDelta}g`}
              </span>
            </div>
            {equivalent ? (
              <div className="mt-0.5 text-[11px] text-[color:var(--text-muted)]">{equivalent}</div>
            ) : null}
            {kcalAfter !== null ? (
              transformationMode === "lean" && kcalBefore !== null ? (
                <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                  <span className="font-semibold text-[color:var(--text-primary)]">Calories:</span> ~{kcalBefore} → ~
                  {kcalAfter} kcal{" "}
                  {kcalDelta !== null && kcalDelta !== 0 ? (
                    <span className="font-semibold text-[color:var(--text-primary)]">
                      ({kcalDelta > 0 ? `+${kcalDelta}` : kcalDelta})
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                  ≈ {kcalAfter} kcal per serving (estimate)
                </div>
              )
            ) : null}
            {previewServings !== servings ? (
              <div className="mt-0.5 text-[11px] text-[color:var(--text-muted)]">
                For {previewServings}: {scaledOriginalProtein}g → {scaledTotalProtein}g (
                {scaledDelta >= 0 ? `+${scaledDelta}g` : `${scaledDelta}g`})
              </div>
            ) : null}
            {swapNote ? (
              <p className="mt-2 rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-1.5 text-[11px] leading-snug text-emerald-950">
                ✓ {swapNote}
              </p>
            ) : null}
            {version.dilConsistencyWarning ? (
              <p className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50/90 px-2.5 py-1.5 text-[11px] leading-snug text-amber-950">
                {version.dilConsistencyWarning}
              </p>
            ) : null}
            {version.proteinMathWarning ? (
              <p className="mt-2 rounded-lg border border-slate-200/80 bg-slate-50/90 px-2.5 py-1.5 text-[11px] leading-snug text-slate-800">
                Protein estimate may be off — {version.proteinMathWarning}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <button
              type="button"
              onClick={toggleExpand}
              aria-expanded={expanded}
              className="min-h-11 text-xs font-semibold text-[color:var(--accent-strong)] hover:underline"
            >
              {expanded ? "Close details" : "See recipe"}
            </button>
          </div>
        </div>

        {!expanded && version.swapSummary && version.swapSummary.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {version.swapSummary.map((summary, i) => (
              <span
                key={`${summary}-${i}`}
                className="rounded-full border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--text-primary)] shadow-sm"
              >
                {summary}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-[240ms] ease-in-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={`px-6 pb-6 pt-1 transition-opacity duration-[240ms] ease-in-out ${expanded ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            <div className="mb-5">
              <div className="font-display text-base font-bold text-[color:var(--text-primary)]">What changed</div>
              {changedSlots.length > 0 ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {changedSlots.map(({ key, label: slotLabel, hint, mark, dotClass }) => {
                    const lines = getSlotLines(version.transformationByComponent, key);
                    return (
                      <div key={key} className={changedBubbleClass}>
                        <div className="flex items-start gap-3">
                          <span className="select-none text-3xl leading-none" aria-hidden>
                            {mark}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />
                              <h3 className="font-display text-lg font-bold leading-tight tracking-tight text-[color:var(--text-primary)]">
                                {slotLabel}
                              </h3>
                            </div>
                            <p className="mt-1 text-[11px] font-medium leading-snug text-[color:var(--text-muted)]">
                              {hint}
                            </p>
                            <ul className="mt-2.5 list-outside list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-[color:var(--text-muted)] marker:text-[color:var(--accent-forest)]">
                              {lines.map((line, i) => (
                                <li key={i} className="ps-0.5">
                                  {humanizeIngredientDisplay(line)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-sm text-[color:var(--text-muted)]">No component-level edits listed.</p>
              )}

              {unchangedSlots.length > 0 ? (
                <div className="mt-4">
                  {!showUnchangedSlots ? (
                    <button
                      type="button"
                      onClick={() => setShowUnchangedSlots(true)}
                      className="text-xs font-semibold text-[color:var(--accent-strong)] underline-offset-2 hover:underline"
                    >
                      Show unchanged parts ({unchangedSlots.length})
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowUnchangedSlots(false)}
                        className="text-xs font-semibold text-[color:var(--text-muted)] underline-offset-2 hover:underline"
                      >
                        Hide unchanged parts
                      </button>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {unchangedSlots.map(({ key, label: slotLabel, hint, mark, dotClass }) => (
                          <div
                            key={key}
                            className="rounded-2xl border-2 border-dashed border-[color:var(--divider)] bg-[color:var(--surface-offset)] p-3.5 opacity-90 shadow-sm"
                          >
                            <div className="flex items-start gap-2.5">
                              <span className="select-none text-2xl leading-none opacity-70" aria-hidden>
                                {mark}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`h-2 w-2 shrink-0 rounded-full opacity-60 ${dotClass}`} aria-hidden />
                                  <span className="font-display text-base font-bold text-[color:var(--text-muted)]">
                                    {slotLabel}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[10px] leading-snug text-[color:var(--text-muted)]">{hint}</p>
                                <p className="mt-1.5 text-[11px] italic text-[color:var(--text-muted)]">
                                  No change in this slot
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>

            <div className="mb-5 border-t border-[color:var(--divider)] pt-4">
              <div className="font-display text-base font-bold text-[color:var(--text-primary)]">How to apply it</div>
              <ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm leading-relaxed text-[color:var(--text-primary)]">
                {version.methodAdjustments.map((step, i) => (
                  <li key={i} className="ps-1">
                    {humanizeIngredientDisplay(step)}
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] shadow-sm">
              <button
                type="button"
                aria-expanded={showFullRecipe}
                onClick={() => setShowFullRecipe((v) => !v)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-[color:var(--surface-offset)]"
              >
                <div>
                  <div className="font-display text-base font-bold text-[color:var(--text-primary)]">Full recipe</div>
                  <div className="text-[11px] text-[color:var(--text-muted)]">
                    Ingredients for {previewServings} · step by step · swaps
                  </div>
                </div>
                <span
                  className="shrink-0 text-lg text-[color:var(--text-muted)] transition-transform"
                  style={{ transform: showFullRecipe ? "rotate(180deg)" : "rotate(0deg)" }}
                  aria-hidden
                >
                  ▼
                </span>
              </button>

              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: showFullRecipe ? "1fr" : "0fr" }}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-5 border-t border-[color:var(--divider)] px-4 pb-4 pt-3">
                    <div>
                      <div className="font-display text-sm font-semibold text-[color:var(--text-primary)]">
                        Ingredients
                      </div>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[color:var(--text-primary)]">
                        {version.ingredients.map((ing) => (
                          <li key={ing.id}>
                            <span className="text-[color:var(--text-muted)]">
                              {humanizeIngredientDisplay(
                                previewServings !== servings ? scaleAmount(ing.amount) : ing.amount
                              )}
                            </span>{" "}
                            <span>{humanizeIngredientDisplay(ing.current)}</span>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        aria-expanded={showCustomizeIngredients}
                        onClick={() => setShowCustomizeIngredients((v) => !v)}
                        className="mt-3 min-h-11 text-xs font-semibold text-[color:var(--accent-strong)] transition hover:underline"
                      >
                        {showCustomizeIngredients ? "Done swapping" : "Swap an ingredient"}
                      </button>
                      {showCustomizeIngredients ? (
                        <div className="mt-2">
                          <p className="mb-2 text-[11px] text-[color:var(--text-muted)]">
                            Pick an ingredient — we rewrite just this version around your change (about 20 seconds).
                          </p>
                          <IngredientList
                            ingredients={version.ingredients}
                            formatAmount={previewServings !== servings ? scaleAmount : undefined}
                            swapDisabled={swapDisabled}
                            onSwapIngredient={(ingredientId, request) =>
                              onSwapIngredient(version.id, ingredientId, request)
                            }
                          />
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <div className="font-display text-sm font-semibold text-[color:var(--text-primary)]">
                        Instructions
                      </div>
                      {version.steps.length > 0 ? (
                        <ol className="mt-2 list-inside list-decimal space-y-2 text-sm leading-relaxed text-[color:var(--text-primary)]">
                          {version.steps.map((step, i) => (
                            <li key={i} className="ps-1">
                              {humanizeIngredientDisplay(step)}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                          No steps were provided for this version.
                        </p>
                      )}
                    </div>

                    {showMealPrepNote ? (
                      <div className="rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-offset)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
                        {version.mealPrepNote}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <CookedButton
                dish={dish}
                version={version}
                label={label}
                servings={previewServings}
                transformationMode={transformationMode}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <ShareButton dish={dish} version={version} label={label} />
              <CopyRecipeButton
                dishLabel={dish}
                version={version}
                transformationMode={transformationMode}
                servings={previewServings}
                formatAmount={previewServings !== servings ? scaleAmount : undefined}
              />
              <FeedbackButton dish={dish} resultId={resultId} version={version} transformationMode={transformationMode} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
