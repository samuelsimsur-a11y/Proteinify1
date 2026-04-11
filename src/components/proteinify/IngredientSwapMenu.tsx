"use client";

import { useMemo, useState } from "react";
import type { Ingredient, IngredientSwapOption } from "@/lib/proteinify/types";
import SwapOptionButton from "./SwapOptionButton";

type Props = {
  ingredient: Ingredient;
  disabled?: boolean;
  onSwap: (replacement: string) => void;
};

export default function IngredientSwapMenu({ ingredient, disabled, onSwap }: Props) {
  const [open, setOpen] = useState(false);
  const selectedReplacement = ingredient.current;

  const options: IngredientSwapOption[] = useMemo(() => ingredient.swapOptions, [ingredient]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={[
          "rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
          "border-[color:var(--divider)] bg-[color:var(--surface-card)] text-[color:var(--text-muted)]",
          "hover:bg-[color:var(--accent-light)] hover:text-[color:var(--accent)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        ].join(" ")}
      >
        Swap options
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-[min(calc(100vw-2rem),22rem)] min-w-[17.5rem] rounded-2xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] p-3 shadow-lg ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-[color:var(--text-primary)]">Swap options</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-[color:var(--text-muted)]"
            >
              Close
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {options.map((opt) => {
              const isSelected = selectedReplacement === opt.replacement;
              return (
                <SwapOptionButton
                  key={`${ingredient.id}:${opt.type}:${opt.replacement}`}
                  option={opt}
                  isSelected={isSelected}
                  onPick={() => {
                    onSwap(opt.replacement);
                    setOpen(false);
                  }}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

