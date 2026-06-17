"use client";

import type { TransformationMode } from "@/lib/wisedish/types";

type Props = {
  mode: TransformationMode;
};

export default function TierLegend({ mode }: Props) {
  const third = mode === "lean" ? "Fully Light" : "Full Send";

  const tiers = [
    {
      name: "Close Match",
      desc:
        mode === "lean"
          ? "One subtle fat swap — guests shouldn’t notice."
          : "Whole-food protein boost (+8g min) — no powders.",
    },
    {
      name: "Balanced",
      desc: "2–3 levers combined — fair trade-off, still your dish.",
    },
    {
      name: third,
      desc:
        mode === "lean"
          ? "Leanest version — honest about texture change."
          : "Maximum protein — names the sensory cost.",
    },
  ] as const;

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      {tiers.map((t) => (
        <div
          key={t.name}
          className="rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-offset)] px-3 py-2"
        >
          <div className="text-xs font-semibold text-[color:var(--text-primary)]">{t.name}</div>
          <div className="mt-0.5 text-[11px] leading-snug text-[color:var(--text-muted)]">{t.desc}</div>
        </div>
      ))}
    </div>
  );
}
