"use client";

import { useEffect, useMemo, useState } from "react";
import type { RecipeVersion, TransformationMode } from "@/lib/wisedish/types";
import { displayVersionLabel } from "@/lib/wisedish/displayVersionLabel";
import { sendFeedback } from "@/lib/feedback/sendFeedback";

type Props = {
  dish: string;
  resultId: string;
  version: RecipeVersion;
  transformationMode: TransformationMode;
};

const FEEDBACK_TAGS = [
  "tasted weird",
  "unrealistic ingredients",
  "too expensive",
  "too much effort",
  "not enough protein",
  "protein numbers seem wrong",
  "app bug",
  "other",
] as const;

type FeedbackTag = (typeof FEEDBACK_TAGS)[number];

export default function FeedbackButton({ dish, resultId, version, transformationMode }: Props) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<"up" | "down">("up");
  const [tag, setTag] = useState<FeedbackTag>("other");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusText, setStatusText] = useState("");

  const title = useMemo(
    () => `Feedback for ${displayVersionLabel(version, transformationMode)}`,
    [version, transformationMode]
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const submitFeedback = async () => {
    setSubmitting(true);
    setStatusText("");
    const ok = await sendFeedback({
      rating: rating === "up" ? 1 : -1,
      category: rating === "down" ? tag : "positive",
      message: message.trim(),
      context: {
        resultId,
        dish,
        version: displayVersionLabel(version, transformationMode),
        transformationMode,
      },
    });
    setSubmitting(false);
    if (ok) {
      setStatusText("Thanks — your feedback reached us.");
      setMessage("");
      window.setTimeout(() => setOpen(false), 1200);
    } else {
      setStatusText("Couldn't send right now. Check your connection and try again.");
    }
  };

  return (
    <div>
      <button
        type="button"
        title={title}
        onClick={() => setOpen((v) => !v)}
        className="min-h-11 rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-offset)]"
      >
        Feedback
      </button>

      {open ? (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-end justify-center bg-[color:rgba(0,0,0,0.35)] p-4 sm:items-center"
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
              <div className="text-sm font-semibold text-[color:var(--text-primary)]">{title}</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 px-2 text-xs text-[color:var(--text-muted)]"
              >
                Close
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                aria-pressed={rating === "up"}
                onClick={() => setRating("up")}
                className={[
                  "min-h-11 flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                  rating === "up"
                    ? "border-[color:var(--accent-forest)] bg-[color:var(--accent-forest-light)] text-[color:var(--accent-forest)]"
                    : "border-[color:var(--divider)] bg-[color:var(--surface-card)] text-[color:var(--text-primary)]",
                ].join(" ")}
              >
                👍 Good
              </button>
              <button
                type="button"
                aria-pressed={rating === "down"}
                onClick={() => setRating("down")}
                className={[
                  "min-h-11 flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                  rating === "down"
                    ? "border-[#C73A2B] bg-[rgba(199,58,43,0.12)] text-[#A82E21]"
                    : "border-[color:var(--divider)] bg-[color:var(--surface-card)] text-[color:var(--text-primary)]",
                ].join(" ")}
              >
                👎 Not great
              </button>
            </div>

            {rating === "down" ? (
              <>
                <label className="mt-3 block text-[11px] text-[color:var(--text-muted)]" htmlFor="feedback-tag">
                  What went wrong?
                </label>
                <select
                  id="feedback-tag"
                  value={tag}
                  onChange={(e) => setTag(e.target.value as FeedbackTag)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-3 py-2 text-xs text-[color:var(--text-primary)]"
                >
                  {FEEDBACK_TAGS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </>
            ) : null}

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={3}
              aria-label="Your feedback"
              placeholder="Tell us more (optional)"
              className="mt-3 w-full rounded-xl border border-[color:var(--divider)] bg-[color:var(--bg)] px-3 py-2 text-xs text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)]"
            />

            <button
              type="button"
              onClick={() => void submitFeedback()}
              disabled={submitting}
              className="mt-3 min-h-11 w-full rounded-xl bg-[color:var(--accent)] px-3 py-2 text-xs font-bold text-[color:var(--on-accent)] disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Send feedback"}
            </button>
            <div className="mt-2 text-[11px] text-[color:var(--text-muted)]">No account needed.</div>
            {statusText ? (
              <div role="status" className="mt-2 text-[11px] text-[color:var(--text-primary)]">
                {statusText}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
