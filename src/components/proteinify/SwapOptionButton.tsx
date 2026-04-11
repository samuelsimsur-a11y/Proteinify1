"use client";

import type { IngredientSwapOption } from "@/lib/proteinify/types";

type Props = {
  option: IngredientSwapOption;
  isSelected: boolean;
  onPick: () => void;
};

export default function SwapOptionButton({ option, isSelected, onPick }: Props) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={[
        "w-full rounded-xl border px-3 py-2.5 text-left text-xs leading-snug transition sm:py-3",
        isSelected
          ? "border-[color:var(--accent)] bg-[color:var(--accent-light)]"
          : "border-[color:var(--divider)] bg-[color:var(--surface-card)] hover:bg-[color:var(--surface-offset)]",
      ].join(" ")}
    >
      <div className="font-display font-semibold text-[color:var(--text-primary)]">{option.label}</div>
      <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">{option.effect}</div>
    </button>
  );
}

