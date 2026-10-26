"use client";

import { useEffect, useState } from "react";
import type { RecipeVersion, TransformationMode } from "@/lib/wisedish/types";
import { logCooked, type CookRating } from "@/lib/cookLog";
import { sendFeedback } from "@/lib/feedback/sendFeedback";
import { track } from "@/lib/analytics";
import { getAppRouteHref } from "@/lib/navigation/appRoutes";

type Props = {
  dish: string;
  version: RecipeVersion;
  label: string;
  servings: number;
  transformationMode: TransformationMode;
};

const RATINGS: { value: CookRating; emoji: string; text: string }[] = [
  { value: 2, emoji: "🔥", text: "Loved it" },
  { value: 1, emoji: "👍", text: "Good" },
  { value: 0, emoji: "😐", text: "Meh" },
  { value: -1, emoji: "👎", text: "Didn't work" },
];

export default function CookedButton({ dish, version, label, servings, transformationMode }: Props) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<CookRating | null>(null);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ addedG: number; bankG: number; streak: number; milestone: number | null } | null>(
    null
  );

  useEffect(() => {
    if (!result) return;
    const t = window.setTimeout(() => setResult(null), 6000);
    return () => window.clearTimeout(t);
  }, [result]);

  const total = Math.round(version.totalProteinG ?? version.macros.p);
  const before = Math.max(0, Math.round(total - version.macros.d));
  const added = total - before;

  const submit = () => {
    if (rating === null) return;
    const { stats, newMilestoneG } = logCooked({
      dish,
      versionId: version.id,
      versionLabel: label,
      proteinAddedG: added,
      totalProteinG: total,
      servings,
      rating,
    });
    track("cooked", { rating, tier: version.id, mode: transformationMode });
    if (newMilestoneG) track("milestone_unlocked", { grams: newMilestoneG });
    void sendFeedback({
      rating,
      category: "cooked",
      message: note.trim(),
      context: {
        dish,
        version: label,
        transformationMode,
        proteinBefore: before,
        proteinAfter: total,
      },
    });
    setResult({
      addedG: Math.max(0, added) * Math.max(1, servings),
      bankG: stats.totalAddedG,
      streak: stats.weekStreak,
      milestone: newMilestoneG,
    });
    setOpen(false);
    setRating(null);
    setNote("");
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-12 w-full rounded-xl bg-[color:var(--accent)] px-4 py-2.5 text-sm font-bold text-[color:var(--on-accent)] shadow-sm transition hover:brightness-[0.97] active:scale-[0.99]"
      >
        🍳 I cooked this
      </button>

      {result ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-2 rounded-xl border border-emerald-200/80 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-950"
        >
          {result.milestone ? (
            <div className="font-display text-sm font-bold">🏆 Milestone: {result.milestone}g of protein banked!</div>
          ) : null}
          <div className={result.milestone ? "mt-0.5" : "font-semibold"}>
            +{result.addedG}g banked · Protein Bank: {result.bankG}g
            {result.streak > 1 ? ` · 🔥 ${result.streak}-week streak` : ""}
          </div>
          <a href={getAppRouteHref("log")} className="mt-1 inline-block min-h-9 font-semibold text-emerald-900 underline">
            See your Protein Bank →
          </a>
        </div>
      ) : null}

      {open ? (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-end justify-center bg-[color:rgba(0,0,0,0.4)] p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="How did it turn out?"
            className="w-full max-w-sm rounded-2xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="font-display text-base font-bold text-[color:var(--text-primary)]">How did it turn out?</div>
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-2 text-xs text-[color:var(--text-muted)]">
                Close
              </button>
            </div>
            <p className="mt-1 text-xs text-[color:var(--text-muted)]">
              {label} {dish} · +{Math.max(0, added)}g protein per serving
            </p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {RATINGS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  aria-pressed={rating === r.value}
                  onClick={() => setRating(r.value)}
                  className={[
                    "flex min-h-16 flex-col items-center justify-center rounded-xl border px-1 py-2 text-[11px] font-semibold transition",
                    rating === r.value
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-light)] text-[color:var(--text-primary)]"
                      : "border-[color:var(--divider)] text-[color:var(--text-muted)]",
                  ].join(" ")}
                >
                  <span className="text-xl" aria-hidden>
                    {r.emoji}
                  </span>
                  {r.text}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Anything we should know? (optional)"
              className="mt-3 w-full rounded-xl border border-[color:var(--divider)] bg-[color:var(--bg)] px-3 py-2 text-xs text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)]"
            />
            <button
              type="button"
              onClick={submit}
              disabled={rating === null}
              className="mt-3 min-h-11 w-full rounded-xl bg-[color:var(--accent)] px-3 py-2 text-sm font-bold text-[color:var(--on-accent)] disabled:opacity-50"
            >
              Bank my protein
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
