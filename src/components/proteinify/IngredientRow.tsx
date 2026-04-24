"use client";

import type { Ingredient } from "@/lib/proteinify/types";
import { humanizeIngredientDisplay } from "./humanizeIngredientDisplay";
import IngredientSwapMenu from "./IngredientSwapMenu";

type Props = {
  ingredient: Ingredient;
  swapDisabled?: boolean;
  onSwap: (replacement: string) => void;
};

export default function IngredientRow({ ingredient, swapDisabled, onSwap }: Props) {
  const reason = (ingredient.reason ?? "").trim();

  return (
    <div className="rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-3 py-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-[color:var(--text-primary)]">
            <span className="text-[color:var(--text-muted)]">
              {humanizeIngredientDisplay(ingredient.original)}
            </span>
            <span className="text-[color:var(--accent)]">→</span>
            <span className="font-medium">{humanizeIngredientDisplay(ingredient.current)}</span>
          </div>
          {reason ? (
            <p className="mt-1.5 text-xs leading-snug text-[color:var(--text-muted)]">
              {humanizeIngredientDisplay(reason)}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-row items-center justify-end gap-3 sm:flex-col sm:items-end sm:gap-1.5">
          <div className="text-[11px] text-[color:var(--text-muted)] sm:text-right">
            {humanizeIngredientDisplay(ingredient.amount)}
          </div>
          <IngredientSwapMenu ingredient={ingredient} disabled={swapDisabled} onSwap={onSwap} />
        </div>
      </div>
    </div>
  );
}

