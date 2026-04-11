"use client";

import type { RecipeVersion } from "@/lib/proteinify/types";
import IngredientList from "./IngredientList";
import CopyRecipeButton from "./CopyRecipeButton";
import FeedbackButton from "./FeedbackButton";
import { humanizeIngredientDisplay } from "./humanizeIngredientDisplay";
import { COMPONENT_SLOTS, getSlotLines, slotHasContent } from "./transformationUiConstants";
import { VERSION_CARD_LEGACY_LAYOUT } from "./versionCardLayout";
import { useEffect, useMemo, useState } from "react";

type Props = {
  dish: string;
  servings: 1 | 2 | 4 | 6 | 8;
  previewServings: number;
  resultId: string;
  version: RecipeVersion;
  expanded: boolean;
  onToggleExpand: () => void;
  isLast: boolean;
  isRegenerating?: boolean;
  swapDisabled?: boolean;
  onSwapIngredient: (versionId: RecipeVersion["id"], ingredientId: string, replacement: string) => void;
};

const changedBubbleClass =
  "rounded-2xl border-2 border-[color:var(--accent-forest)]/35 bg-gradient-to-br from-[color:var(--accent-forest-light)] via-[color:var(--surface-card)] to-[color:var(--surface-offset)] p-4 shadow-md ring-1 ring-[color:rgba(0,0,0,0.05)]";

function VersionCardLegacy({
  dish,
  servings,
  previewServings,
  resultId,
  version,
  expanded,
  onToggleExpand,
  isLast,
  isRegenerating,
  swapDisabled,
  onSwapIngredient,
}: Props) {
  const scaleFactor = Math.max(0.01, previewServings / servings);
  const scaleAmount = (amount: string): string => {
    const round = (n: number) => {
      if (n >= 100) return Math.round(n).toString();
      if (n >= 10) return (Math.round(n * 10) / 10).toString();
      return (Math.round(n * 100) / 100).toString();
    };

    const scaled = amount.replace(
      /(\d+(?:\.\d+)?)(\s*)(g|kg|ml|l|tbsp|tsp|cup|cups|oz|lb|lbs|clove|cloves|slice|slices|piece|pieces|can|cans)\b/gi,
      (_m, num, space, unit) => `${round(Number(num) * scaleFactor)}${space}${unit}`
    );

    return scaled.replace(/\(for\s+\d+\s+servings\)/i, `(for ${previewServings} servings)`);
  };

  const [showCustomizeIngredients, setShowCustomizeIngredients] = useState(false);
  const [showUnchangedSlots, setShowUnchangedSlots] = useState(false);

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

  useEffect(() => {
    if (!expanded) {
      setShowCustomizeIngredients(false);
      setShowUnchangedSlots(false);
    }
  }, [expanded]);

  const originalProtein = Math.max(0, version.macros.p - version.macros.d);
  const totalProtein = version.totalProteinG ?? version.macros.p;
  const computedDelta = Math.round(totalProtein - originalProtein);
  const scaledOriginalProtein = Math.round(originalProtein * scaleFactor);
  const scaledDelta = Math.round(computedDelta * scaleFactor);
  const scaledTotalProtein = Math.round(totalProtein * scaleFactor);
  const showMealPrepNote = servings > 1 && !!version.mealPrepNote;
  const deltaPerIngredient =
    version.ingredients.length > 0 ? Math.max(1, Math.round(computedDelta / version.ingredients.length)) : 0;

  const fullRecipeToggleLabel = expanded
    ? "Hide ingredients and instructions"
    : "Show ingredients and instructions";

  return (
    <div className={`relative overflow-hidden ${isLast ? "" : "border-b border-[color:var(--divider)]"}`}>
      {isRegenerating ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[var(--radius-card)] bg-[color:rgba(0,0,0,0.06)] backdrop-blur-[1px]">
          <div className="rounded-full border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-4 py-2 text-xs font-semibold text-[color:var(--text-muted)] shadow-sm">
            Updating this version…
          </div>
        </div>
      ) : null}

      <div className="px-[18px] py-4 transition-colors hover:bg-[color:var(--surface-offset)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-bold text-[color:var(--text-primary)]">{version.label}</div>
            <div className="mt-0.5 line-clamp-2 text-sm text-[color:var(--text-muted)]">{version.summary}</div>
            <div className="mt-1 text-xs text-[color:var(--text-muted)]">
              <span className="font-semibold text-[color:var(--text-primary)]">Protein per serving:</span>{" "}
              {originalProtein}g baseline → {totalProtein}g after{" "}
              <span className="font-semibold text-[color:var(--text-primary)]">
                ({computedDelta >= 0 ? `+${computedDelta}g` : `${computedDelta}g`} delta)
              </span>
            </div>
            {previewServings !== servings ? (
              <div className="mt-0.5 text-[11px] text-[color:var(--text-muted)]">
                Protein scaled for {previewServings} servings (amounts): {scaledOriginalProtein}g → {scaledTotalProtein}g (
                {scaledDelta >= 0 ? `+${scaledDelta}g` : `${scaledDelta}g`} delta)
              </div>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <button
              type="button"
              onClick={onToggleExpand}
              className="mt-1 block text-xs font-semibold text-[color:var(--text-muted)] hover:text-[color:var(--accent)]"
            >
              {fullRecipeToggleLabel}
            </button>
          </div>
        </div>

        {version.swapSummary && version.swapSummary.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {version.swapSummary.map((summary, i) => (
              <span
                key={`${summary}-${i}`}
                className="rounded-full border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--text-primary)]"
              >
                {summary}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2.5" title="Parts of the dish this tier touches">
          {COMPONENT_SLOTS.map(({ key, label, mark, hint, dotClass }) => {
            const active = slotHasContent(version.transformationByComponent[key]);
            return (
              <span
                key={key}
                title={hint}
                className={[
                  "inline-flex items-center gap-2 rounded-2xl border-2 px-3 py-2 shadow-sm transition-shadow",
                  active
                    ? "border-[color:var(--accent-forest)]/35 bg-[color:var(--accent-forest-light)] text-[color:var(--accent-forest)] shadow-md"
                    : "border-[color:var(--divider)] bg-[color:var(--surface-card)] text-[color:var(--text-muted)]",
                ].join(" ")}
              >
                <span className="select-none text-lg leading-none" aria-hidden>
                  {mark}
                </span>
                <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
                <span className="font-display text-xs font-bold tracking-tight">{label}</span>
              </span>
            );
          })}
        </div>

        <div className="mt-4 border-t border-[color:var(--divider)] pt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">
            How to apply it
          </div>
          <ol className="mt-1.5 list-inside list-decimal space-y-1 text-sm leading-relaxed text-[color:var(--text-primary)]">
            {version.methodAdjustments.map((step, i) => (
              <li key={i} className="ps-1">
                {humanizeIngredientDisplay(step)}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-[240ms] ease-in-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={`px-6 pb-6 pt-1 transition-opacity duration-[240ms] ease-in-out ${expanded ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            <div className="mb-6">
              <div className="font-display text-sm font-bold text-[color:var(--text-primary)]">What changed</div>
              {changedSlots.length > 0 ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {changedSlots.map(({ key, label, hint, mark, dotClass }) => {
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
                                {label}
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
                      className="text-xs font-semibold text-[color:var(--accent)] underline-offset-2 hover:underline"
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
                        {unchangedSlots.map(({ key, label, hint, mark, dotClass }) => (
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
                                    {label}
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

            <div>
              <div className="font-display text-sm font-semibold text-[color:var(--text-primary)]">Ingredients</div>
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
                className="mt-3 text-xs font-semibold text-[color:var(--text-muted)] transition hover:text-[color:var(--accent)]"
              >
                Customize ingredients
              </button>
              {showCustomizeIngredients ? (
                <div className="mt-3">
                  <IngredientList
                    ingredients={version.ingredients}
                    swapDisabled={swapDisabled}
                    deltaPerIngredient={deltaPerIngredient}
                    onSwapIngredient={(ingredientId, replacement) =>
                      onSwapIngredient(version.id, ingredientId, replacement)
                    }
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-6">
              <div className="font-display text-sm font-semibold text-[color:var(--text-primary)]">Instructions</div>
              {version.steps.length > 0 ? (
                <ol className="mt-2 list-inside list-decimal space-y-2 text-sm leading-relaxed text-[color:var(--text-primary)]">
                  {version.steps.map((step, i) => (
                    <li key={i} className="ps-1">
                      {humanizeIngredientDisplay(step)}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-sm text-[color:var(--text-muted)]">No steps were provided for this version.</p>
              )}
            </div>

            {showMealPrepNote ? (
              <div className="mt-4 rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-offset)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
                {version.mealPrepNote}
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CopyRecipeButton dishLabel={dish} version={version} />
              <FeedbackButton dish={dish} resultId={resultId} version={version} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VersionCardV2({
  dish,
  servings,
  previewServings,
  resultId,
  version,
  expanded,
  onToggleExpand,
  isLast,
  isRegenerating,
  swapDisabled,
  onSwapIngredient,
}: Props) {
  const scaleFactor = Math.max(0.01, previewServings / servings);
  const scaleAmount = (amount: string): string => {
    const round = (n: number) => {
      if (n >= 100) return Math.round(n).toString();
      if (n >= 10) return (Math.round(n * 10) / 10).toString();
      return (Math.round(n * 100) / 100).toString();
    };

    const scaled = amount.replace(
      /(\d+(?:\.\d+)?)(\s*)(g|kg|ml|l|tbsp|tsp|cup|cups|oz|lb|lbs|clove|cloves|slice|slices|piece|pieces|can|cans)\b/gi,
      (_m, num, space, unit) => `${round(Number(num) * scaleFactor)}${space}${unit}`
    );

    return scaled.replace(/\(for\s+\d+\s+servings\)/i, `(for ${previewServings} servings)`);
  };

  const [showCustomizeIngredients, setShowCustomizeIngredients] = useState(false);
  const [showUnchangedSlots, setShowUnchangedSlots] = useState(false);
  const [showFullRecipe, setShowFullRecipe] = useState(false);

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

  useEffect(() => {
    if (!expanded) {
      setShowCustomizeIngredients(false);
      setShowUnchangedSlots(false);
      setShowFullRecipe(false);
    }
  }, [expanded]);

  const originalProtein = Math.max(0, version.macros.p - version.macros.d);
  const totalProtein = version.totalProteinG ?? version.macros.p;
  const computedDelta = Math.round(totalProtein - originalProtein);
  const scaledOriginalProtein = Math.round(originalProtein * scaleFactor);
  const scaledDelta = Math.round(computedDelta * scaleFactor);
  const scaledTotalProtein = Math.round(totalProtein * scaleFactor);
  const showMealPrepNote = servings > 1 && !!version.mealPrepNote;
  const deltaPerIngredient =
    version.ingredients.length > 0 ? Math.max(1, Math.round(computedDelta / version.ingredients.length)) : 0;

  const mainToggleLabel = expanded ? "Close details" : "See transformation";

  return (
    <div className={`relative overflow-hidden ${isLast ? "" : "border-b border-[color:var(--divider)]"}`}>
      {isRegenerating ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[var(--radius-card)] bg-[color:rgba(0,0,0,0.06)] backdrop-blur-[1px]">
          <div className="rounded-full border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-4 py-2 text-xs font-semibold text-[color:var(--text-muted)] shadow-sm">
            Updating this version…
          </div>
        </div>
      ) : null}

      {/* Header: label, light teaser, macro — swap pills only when collapsed to avoid repeating the story */}
      <div className="px-[18px] py-4 transition-colors hover:bg-[color:var(--surface-offset)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-bold text-[color:var(--text-primary)]">{version.label}</div>
            {version.summary ? (
              <div className="mt-0.5 line-clamp-1 text-sm text-[color:var(--text-muted)]">{version.summary}</div>
            ) : null}
            <div className="mt-1 text-xs text-[color:var(--text-muted)]">
              <span className="font-semibold text-[color:var(--text-primary)]">Protein per serving:</span>{" "}
              {originalProtein}g baseline → {totalProtein}g after{" "}
              <span className="font-semibold text-[color:var(--text-primary)]">
                ({computedDelta >= 0 ? `+${computedDelta}g` : `${computedDelta}g`} delta)
              </span>
            </div>
            {previewServings !== servings ? (
              <div className="mt-0.5 text-[11px] text-[color:var(--text-muted)]">
                Protein scaled for {previewServings} servings (amounts): {scaledOriginalProtein}g → {scaledTotalProtein}g (
                {scaledDelta >= 0 ? `+${scaledDelta}g` : `${scaledDelta}g`} delta)
              </div>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <button
              type="button"
              onClick={onToggleExpand}
              className="mt-1 block text-xs font-semibold text-[color:var(--accent)] hover:underline"
            >
              {mainToggleLabel}
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
                  {changedSlots.map(({ key, label, hint, mark, dotClass }) => {
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
                                {label}
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
                      className="text-xs font-semibold text-[color:var(--accent)] underline-offset-2 hover:underline"
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
                        {unchangedSlots.map(({ key, label, hint, mark, dotClass }) => (
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
                                    {label}
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
                        className="mt-3 text-xs font-semibold text-[color:var(--text-muted)] transition hover:text-[color:var(--accent)]"
                      >
                        Customize ingredients
                      </button>
                      {showCustomizeIngredients ? (
                        <div className="mt-3">
                          <IngredientList
                            ingredients={version.ingredients}
                            swapDisabled={swapDisabled}
                            deltaPerIngredient={deltaPerIngredient}
                            onSwapIngredient={(ingredientId, replacement) =>
                              onSwapIngredient(version.id, ingredientId, replacement)
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

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CopyRecipeButton dishLabel={dish} version={version} />
              <FeedbackButton dish={dish} resultId={resultId} version={version} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VersionCard(props: Props) {
  if (VERSION_CARD_LEGACY_LAYOUT) {
    return <VersionCardLegacy {...props} />;
  }
  return <VersionCardV2 {...props} />;
}
