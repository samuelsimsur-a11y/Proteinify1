"use client";

import type {
  DishClassificationSummary,
  WiseDishResponse,
  RecipeVersion,
  TransformationMode,
} from "@/lib/wisedish/types";
import type { SwapIntent } from "@/lib/wisedish/clientGenerate";
import { useState } from "react";
import VersionCard from "./VersionCard";
import TierLegend from "./TierLegend";
import GenerationProgress from "./GenerationProgress";
import { humanizeGenerateError } from "@/lib/wisedish/userFacingErrors";

type VersionId = RecipeVersion["id"];

type StreamingSlots = [RecipeVersion | null, RecipeVersion | null, RecipeVersion | null];

type Props = {
  response: WiseDishResponse | null;
  classification?: DishClassificationSummary | null;
  onRetryWrongDish?: () => void;
  /** Slots shown while generating (slot 0 may fill early from the quick preview). */
  streamingVersions: StreamingSlots | null;
  generationStartedAt: number | null;
  isImporting?: boolean;
  resultId: string;
  dish: string;
  transformationMode: TransformationMode;
  servings: 1 | 2 | 4 | 6 | 8;
  previewServings: number;
  onChangePreviewServings: (next: number) => void;
  error: string | null;
  importAttribution?: { source: "youtube" | "tiktok"; originalTitle: string } | null;
  showLowConfidenceImportNotice?: boolean;
  cacheNotice?: {
    title: string;
    subtitle?: string;
    actionLabel: string;
    actionDisabled?: boolean;
    onAction: () => void;
  } | null;
  isGenerating: boolean;
  regeneratingVersionId: VersionId | null;
  swapNotes?: Partial<Record<VersionId, string>>;
  onSwapIngredient: (
    versionId: VersionId,
    ingredientId: string,
    request: { intent: SwapIntent; replacement?: string }
  ) => void;
  onRegenerateAll: () => void;
  onRetry: () => void;
};

export default function ResultsPreview({
  response,
  classification,
  onRetryWrongDish,
  streamingVersions,
  generationStartedAt,
  isImporting,
  resultId,
  dish,
  transformationMode,
  servings,
  previewServings,
  onChangePreviewServings,
  error,
  importAttribution,
  showLowConfidenceImportNotice,
  cacheNotice,
  isGenerating,
  regeneratingVersionId,
  swapNotes,
  onSwapIngredient,
  onRegenerateAll,
  onRetry,
}: Props) {
  const inProgress = isGenerating && streamingVersions !== null;
  // Expanded card is remembered per result, so a new result always starts collapsed.
  const [expanded, setExpanded] = useState<{ resultId: string; id: VersionId | null }>({ resultId, id: null });
  const expandedVersionId = expanded.resultId === resultId ? expanded.id : null;
  const toggleExpanded = (id: VersionId) =>
    setExpanded({ resultId, id: expandedVersionId === id ? null : id });
  const firstVersionReady = Boolean(streamingVersions?.[0]);

  return (
    <section className="px-4 pt-6">
      <div className="mx-auto w-full max-w-3xl">
        {importAttribution ? (
          <div className="mb-2 px-1 text-[11px] text-[color:var(--text-muted)]">
            Transformed from: {importAttribution.originalTitle} •{" "}
            {importAttribution.source === "youtube" ? "YouTube" : "TikTok"}
          </div>
        ) : null}
        {showLowConfidenceImportNotice ? (
          <div className="mb-2 rounded-xl border border-yellow-300/80 bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
            The caption didn&apos;t have a full recipe — we used the dish name to generate your transformation.
            Results may vary.
          </div>
        ) : null}
        {cacheNotice && !inProgress ? (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-3 py-2 text-xs transition-all duration-200">
            <span className="text-[color:var(--text-muted)]">{cacheNotice.title}</span>
            <button
              type="button"
              onClick={cacheNotice.onAction}
              disabled={cacheNotice.actionDisabled}
              className="min-h-9 font-semibold text-[color:var(--accent-strong)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cacheNotice.actionLabel}
            </button>
            {cacheNotice.subtitle ? (
              <span className="w-full text-[11px] text-[color:var(--text-muted)]">{cacheNotice.subtitle}</span>
            ) : null}
          </div>
        ) : null}
        <div className="pf-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-display text-sm font-semibold text-[color:var(--text-primary)]">
                Your transformed versions
              </div>
              <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                Close Match · Balanced · {transformationMode === "lean" ? "Fully Light" : "Full Send"}
              </div>
            </div>
            <div className="shrink-0 rounded-[var(--radius-pill)] border border-[color:var(--divider)] bg-[color:var(--surface-offset)] px-2.5 py-1.5">
              <div className="text-center text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">
                Portion size
              </div>
              <div className="mt-1 flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => onChangePreviewServings(Math.max(1, previewServings - 1))}
                  className="h-11 w-11 shrink-0 rounded-full border border-[color:var(--divider)] text-sm text-[color:var(--text-muted)] hover:bg-[color:var(--surface-card)]"
                  aria-label="Decrease servings"
                >
                  -
                </button>
                <span className="min-w-[2.5rem] text-center text-sm font-semibold tabular-nums text-[color:var(--text-primary)]">
                  {previewServings}
                </span>
                <button
                  type="button"
                  onClick={() => onChangePreviewServings(Math.min(12, previewServings + 1))}
                  className="h-11 w-11 shrink-0 rounded-full border border-[color:var(--divider)] text-sm text-[color:var(--text-muted)] hover:bg-[color:var(--surface-card)]"
                  aria-label="Increase servings"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* Hidden while generating so the progress card is visible without scrolling. */}
        {response && !inProgress && !error ? <TierLegend mode={transformationMode} /> : null}
        <div className="mt-2 px-1 text-center text-[11px] leading-snug text-[color:var(--text-muted)]">
          Ingredients scale with serving size. Protein stays per serving.
        </div>

        {classification && classification.baseline_protein_g >= 35 ? (
          <div className="mt-3 rounded-xl border border-amber-300/80 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            Already protein-rich — starting at ~{classification.baseline_protein_g}g per serving
          </div>
        ) : null}

        {classification?.assumed_variant &&
        (classification.ambiguity_score === "medium" || classification.ambiguity_score === "low") &&
        !inProgress ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 px-1 text-[11px] text-[color:var(--text-muted)]">
            <span>Interpreted as: {classification.assumed_variant}</span>
            {onRetryWrongDish ? (
              <button
                type="button"
                onClick={onRetryWrongDish}
                className="font-semibold text-[color:var(--accent-strong)] hover:underline"
              >
                Wrong dish? Retry
              </button>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 pf-card p-4" role="alert">
            <div className="font-display text-sm font-semibold text-[color:var(--text-primary)]">Something went wrong</div>
            <div className="mt-1 text-xs leading-relaxed text-[color:var(--text-muted)]">
              {humanizeGenerateError(error) ?? error}
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 min-h-11 rounded-xl bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-[color:var(--on-accent)] hover:brightness-[0.97]"
            >
              Try again
            </button>
          </div>
        ) : null}

        {inProgress ? (
          <div className="mt-4 space-y-3">
            <GenerationProgress
              startedAt={generationStartedAt}
              isImporting={isImporting}
              firstVersionReady={firstVersionReady}
            />
            <div className="flex flex-col overflow-hidden pf-card p-0">
              {streamingVersions!.map((v, i) =>
                v ? (
                  <VersionCard
                    key={v.id}
                    dish={dish}
                    transformationMode={transformationMode}
                    servings={servings}
                    previewServings={previewServings}
                    resultId={resultId}
                    version={v}
                    expanded={expandedVersionId === v.id}
                    onToggleExpand={() => toggleExpanded(v.id)}
                    isLast={i === 2}
                    swapDisabled
                    onSwapIngredient={onSwapIngredient}
                  />
                ) : (
                  <div
                    key={`stream-slot-${i}`}
                    aria-hidden
                    className={`pf-skeleton h-[150px] rounded-none ${i < 2 ? "border-b border-[color:var(--divider)]" : ""}`}
                  />
                )
              )}
            </div>
          </div>
        ) : null}

        {!inProgress && !response && !error ? (
          <div className="mt-4 pf-card p-4 text-xs leading-relaxed text-[color:var(--text-muted)]">
            Results appear here. Tap an example to see one instantly, or type your own dish.
          </div>
        ) : null}

        {!inProgress && response ? (
          <>
            <div className="mt-4 flex flex-col overflow-hidden pf-card p-0">
              {response.versions.map((v, i) => (
                <VersionCard
                  key={`${resultId}-${v.id}`}
                  dish={dish}
                  transformationMode={transformationMode}
                  servings={servings}
                  previewServings={previewServings}
                  resultId={resultId}
                  version={v}
                  expanded={expandedVersionId === v.id}
                  onToggleExpand={() => toggleExpanded(v.id)}
                  isLast={i === response.versions.length - 1}
                  isRegenerating={regeneratingVersionId === v.id}
                  swapDisabled={regeneratingVersionId !== null}
                  swapNote={swapNotes?.[v.id]}
                  revealDelayMs={i * 180}
                  onSwapIngredient={onSwapIngredient}
                />
              ))}
            </div>
            <div className="mt-4 flex justify-center px-1">
              <button
                type="button"
                onClick={() => onRegenerateAll()}
                disabled={isGenerating || regeneratingVersionId !== null}
                className="min-h-11 rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-4 py-2.5 text-xs font-semibold text-[color:var(--text-primary)] transition hover:bg-[color:var(--accent-light)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Regenerate all versions
              </button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
