"use client";

import type { ProteinifyResponse, RecipeVersion, TransformationMode } from "@/lib/proteinify/types";
import { useEffect, useState } from "react";
import VersionCard from "./VersionCard";
import { PROTEIN_ONLY_TAGLINE, PROTEIN_OPTIMIZER_SUBLINE } from "./productCopy";

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
  thirdVersionLabel: "Full Send" | "Fully Light";
  error: string | null;
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
  thirdVersionLabel,
  error,
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
        <div className="pf-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-display text-sm font-semibold text-[color:var(--text-primary)]">
                Your transformed versions
              </div>
              <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                Compare Close Match, Balanced, and {thirdVersionLabel}. {PROTEIN_ONLY_TAGLINE}
              </div>
              <div className="mt-1.5 text-[11px] leading-snug text-[color:var(--text-muted)]">
                {PROTEIN_OPTIMIZER_SUBLINE}
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
                  className="h-6 w-6 shrink-0 rounded-full border border-[color:var(--divider)] text-xs text-[color:var(--text-muted)] hover:bg-[color:var(--surface-card)]"
                  aria-label="Decrease servings"
                >
                  -
                </button>
                <span className="min-w-[2.25rem] text-center text-xs font-semibold tabular-nums text-[color:var(--text-primary)]">
                  {previewServings}
                </span>
                <button
                  type="button"
                  onClick={() => onChangePreviewServings(Math.min(12, previewServings + 1))}
                  className="h-6 w-6 shrink-0 rounded-full border border-[color:var(--divider)] text-xs text-[color:var(--text-muted)] hover:bg-[color:var(--surface-card)]"
                  aria-label="Increase servings"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-2 px-1 text-center text-[11px] leading-snug text-[color:var(--text-muted)]">
          Ingredient amounts scale with the servings you set here; protein numbers stay per serving.
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
            Tap <span className="font-semibold text-[color:var(--text-primary)]">Transform</span> above to generate
            three versions. First run may call OpenAI plus USDA lookups to ground <span className="font-medium">protein</span>{" "}
            numbers — it can take 30–90 seconds. We still don&apos;t show calories, fat, or carbs in the app.
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
