"use client";

import { useEffect, useMemo, useState } from "react";
import type { RecipeVersion } from "@/lib/proteinify/types";

type Props = {
  dish: string;
  resultId: string;
  version: RecipeVersion;
};

const FEEDBACK_TAGS = [
  "tasted weird",
  "unrealistic ingredients",
  "too expensive",
  "too much effort",
  "not enough protein",
  "protein numbers seem wrong",
  "other",
] as const;

type FeedbackTag = (typeof FEEDBACK_TAGS)[number];

function buildFeedbackUrl(params: {
  resultId: string;
  dish: string;
  versionId: RecipeVersion["id"];
  rating: "up" | "down";
  tag?: FeedbackTag;
}) {
  const origin = window.location.origin;
  const url = new URL("/feedback", origin);
  url.searchParams.set("resultId", params.resultId);
  url.searchParams.set("dish", params.dish);
  url.searchParams.set("version", params.versionId);
  url.searchParams.set("rating", params.rating);
  if (params.tag) url.searchParams.set("tag", params.tag);
  return url.toString();
}

export default function FeedbackButton({ dish, resultId, version }: Props) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<"up" | "down">("up");
  const [tag, setTag] = useState<FeedbackTag>("other");

  const title = useMemo(() => `Feedback for ${version.label}`, [version.label]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div>
      <button
        type="button"
        title={title}
        onClick={() => setOpen((v) => !v)}
        className="rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-offset)]"
      >
        Feedback
      </button>

      {open ? (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color:rgba(0,0,0,0.35)] p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Rate this version"
            className="w-full max-w-sm rounded-2xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] p-4 shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-[color:var(--text-primary)]">Rate this version</div>
              <button type="button" onClick={() => setOpen(false)} className="text-xs text-[color:var(--text-muted)]">
                Close
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setRating("up")}
                className={[
                  "flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                  rating === "up"
                    ? "border-[color:var(--accent-forest)] bg-[color:var(--accent-forest-light)] text-[color:var(--accent-forest)]"
                    : "border-[color:var(--divider)] bg-[color:var(--surface-card)]",
                ].join(" ")}
              >
                Upvote
              </button>
              <button
                type="button"
                onClick={() => setRating("down")}
                className={[
                  "flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                  rating === "down"
                    ? "border-[#C73A2B] bg-[rgba(199,58,43,0.12)] text-[#C73A2B]"
                    : "border-[color:var(--divider)] bg-[color:var(--surface-card)]",
                ].join(" ")}
              >
                Downvote
              </button>
            </div>

            <div className="mt-3 text-[11px] text-[color:var(--text-muted)]">
              {rating === "down"
                ? "What went wrong?"
                : "Optional tag (for downvotes we recommend choosing one)."}
            </div>

            <div className="mt-2">
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value as FeedbackTag)}
                className="w-full rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-3 py-2 text-xs text-[color:var(--text-primary)]"
              >
                {FEEDBACK_TAGS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                const feedbackUrl = buildFeedbackUrl({
                  resultId,
                  dish,
                  versionId: version.id,
                  rating,
                  tag: rating === "down" ? tag : undefined,
                });
                window.open(feedbackUrl, "_blank", "noopener,noreferrer");
              }}
              className="mt-3 w-full rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-offset)] px-3 py-2 text-xs font-semibold text-[color:var(--text-primary)] hover:bg-[color:var(--surface-card)]"
            >
              Open feedback page
            </button>

            <button
              type="button"
              onClick={async () => {
                const feedbackUrl = buildFeedbackUrl({
                  resultId,
                  dish,
                  versionId: version.id,
                  rating,
                  tag: rating === "down" ? tag : undefined,
                });
                await navigator.clipboard.writeText(feedbackUrl);
              }}
              className="mt-2 w-full rounded-xl bg-[color:var(--text-primary)] px-3 py-2 text-xs font-semibold text-[color:var(--surface-card)] hover:brightness-[0.98]"
            >
              Copy feedback link
            </button>
            <div className="mt-2 text-[11px] text-[color:var(--text-muted)]">
              No account needed. Nothing saved, nothing tracked.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

