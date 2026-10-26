"use client";

import { useEffect, useState } from "react";

type Props = {
  startedAt: number | null;
  isImporting?: boolean;
  /** True once the quick Close Match preview is on screen. */
  firstVersionReady?: boolean;
};

const STEPS = [
  "Reading your dish",
  "Checking what makes it authentic",
  "Finding protein moves that fit",
  "Writing three versions",
  "Double-checking the protein math",
];

/** Roughly when each step starts (seconds). Steps describe what the server does; timing is approximate. */
const STEP_STARTS_S = [0, 3, 8, 15, 30];

export default function GenerationProgress({ startedAt, isImporting, firstVersionReady }: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);

  const elapsedS = startedAt ? Math.max(0, Math.floor((nowMs - startedAt) / 1000)) : 0;
  const steps = isImporting ? ["Reading the recipe from the video", ...STEPS.slice(1)] : STEPS;
  let current = 0;
  for (let i = 0; i < STEP_STARTS_S.length; i++) if (elapsedS >= STEP_STARTS_S[i]!) current = i;

  return (
    <div className="pf-card p-4" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="pf-spinner" aria-hidden />
          <div className="font-display text-sm font-semibold text-[color:var(--text-primary)]">
            {firstVersionReady ? "Close Match is ready — finishing the other two…" : "Transforming your dish…"}
          </div>
        </div>
        <div className="shrink-0 text-xs tabular-nums text-[color:var(--text-muted)]">{elapsedS}s</div>
      </div>
      <ol className="mt-3 space-y-1.5">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={label}
              className={[
                "flex items-center gap-2 text-xs transition-opacity",
                done || active ? "opacity-100" : "opacity-45",
              ].join(" ")}
            >
              <span
                aria-hidden
                className={[
                  "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  done
                    ? "bg-[color:var(--accent-forest)] text-[color:var(--surface-card)]"
                    : active
                      ? "border-2 border-[color:var(--accent)]"
                      : "border border-[color:var(--divider)]",
                ].join(" ")}
              >
                {done ? "✓" : ""}
              </span>
              <span className={active ? "font-semibold text-[color:var(--text-primary)]" : "text-[color:var(--text-muted)]"}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[11px] text-[color:var(--text-muted)]">
        {elapsedS < 60
          ? "Usually under a minute. Close Match often shows up first."
          : "Complex dishes can take a bit longer — hang tight."}
      </p>
    </div>
  );
}
