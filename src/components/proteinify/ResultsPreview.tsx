"use client";

import type { ProteinifyResponse, RecipeVersion, TransformationMode } from "@/lib/proteinify/types";
import { useEffect, useState } from "react";
import VersionCard from "./VersionCard";
type VersionId = RecipeVersion["id"];

type StreamingSlots = [RecipeVersion | null, RecipeVersion | null, RecipeVersion | null];

type Props = {
  response: ProteinifyResponse | null;
  /** Filled progressively during full generate; null when not streaming. */
  streamingVersions: StreamingSlots | null;
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
  isInitialLoading: boolean;
  isGenerating: boolean;
  regeneratingVersionId: VersionId | null;
  onSwapIngredient: (versionId: VersionId, ingredientId: string, replacement: string) => void;
  onRegenerateAll: () => void;
  onRetry: () => void;
};

export default function ResultsPreview({
  response,
  streamingVersions,
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
  isInitialLoading,
  isGenerating,
  regeneratingVersionId,
  onSwapIngredient,
  onRegenerateAll,
  onRetry,
}: Props) {
  const inStreamMode =
    streamingVersions !== null && (isGenerating || isInitialLoading);
  const showFullSkeleton =
    ((isInitialLoading && !response) || isGenerating) && !inStreamMode;
  const [expandedVersionId, setExpandedVersionId] = useState<VersionId | null>(null);

  useEffect(() => {
    if (response) setExpandedVersionId(null);
  }, [response]);

  useEffect(() => {
    // Always reset to collapsed when a fresh generation starts.
    if (isGenerating || isInitialLoading || streamingVersions) {
      setExpandedVersionId(null);
    }
  }, [isGenerating, isInitialLoading, streamingVersions]);

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
        {cacheNotice ? (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-3 py-2 text-xs transition-all duration-200">
            <span className="text-[color:var(--text-muted)]">{cacheNotice.title}</span>
            <button
              type="button"
              onClick={cacheNotice.onAction}
              disabled={cacheNotice.actionDisabled}
              className="font-semibold text-[color:var(--accent)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
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
                Three versions.
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
        <div className="mt-2 px-1 text-center text-[11px] leading-snug text-[color:var(--text-muted)]">
          Ingredients scale with serving size. Protein stays per serving.
        </div>

        {error ? (
          <div className="mt-4 pf-card p-4">
            <div className="font-display text-sm font-semibold text-[color:var(--text-primary)]">Something went wrong</div>
            <div className="mt-1 text-xs leading-relaxed text-[color:var(--text-muted)]">{error}</div>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-xl bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white hover:brightness-[0.97]"
            >
              Try again
            </button>
          </div>
        ) : null}

        {showFullSkeleton ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="pf-spinner" />
              <div className="text-xs font-semibold text-[color:var(--accent)]">Transforming your dish…</div>
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="pf-card pf-skeleton h-[410px] rounded-[var(--radius-card)]" />
            ))}
          </div>
        ) : null}

        {inStreamMode ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="pf-spinner" />
              <div className="text-xs font-semibold text-[color:var(--accent)]">Streaming versions…</div>
            </div>
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
                    onToggleExpand={() =>
                      setExpandedVersionId((prev) => (prev === v.id ? null : v.id))
                    }
                    isLast={i === 2}
                    swapDisabled
                    onSwapIngredient={onSwapIngredient}
                  />
                ) : (
                  <div
                    key={`stream-slot-${i}`}
                    className={`pf-skeleton h-[410px] rounded-none ${i < 2 ? "border-b border-[color:var(--divider)]" : ""}`}
                  />
                )
              )}
            </div>
          </div>
        ) : null}

        {!showFullSkeleton && !inStreamMode && !response && !error ? (
          <div className="mt-4 pf-card p-4 text-xs leading-relaxed text-[color:var(--text-muted)]">
            Results appear here. First run can take up to 30 seconds.
          </div>
        ) : null}

        {!showFullSkeleton && !inStreamMode && response ? (
          <>
            <div className="mt-4 flex flex-col overflow-hidden pf-card p-0">
              {response.versions.map((v, i) => (
                <VersionCard
                  key={v.id}
                  dish={dish}
                  transformationMode={transformationMode}
                  servings={servings}
                  previewServings={previewServings}
                  resultId={resultId}
                  version={v}
                  expanded={expandedVersionId === v.id}
                  onToggleExpand={() =>
                    setExpandedVersionId((prev) => (prev === v.id ? null : v.id))
                  }
                  isLast={i === response.versions.length - 1}
                  isRegenerating={regeneratingVersionId === v.id}
                  swapDisabled={regeneratingVersionId !== null}
                  onSwapIngredient={onSwapIngredient}
                />
              ))}
            </div>
            <div className="mt-4 flex justify-center px-1">
              <button
                type="button"
                onClick={() => onRegenerateAll()}
                disabled={
                  isGenerating || isInitialLoading || regeneratingVersionId !== null
                }
                className="rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-4 py-2.5 text-xs font-semibold text-[color:var(--text-primary)] transition hover:bg-[color:var(--accent-light)] hover:text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
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
