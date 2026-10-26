"use client";

import type { Ingredient } from "@/lib/wisedish/types";
import type { SwapIntent } from "@/lib/wisedish/clientGenerate";
import IngredientRow from "./IngredientRow";

type Props = {
  ingredients: Ingredient[];
  swapDisabled?: boolean;
  /** Scales amounts to the selected portion size for display. */
  formatAmount?: (amount: string) => string;
  onSwapIngredient: (ingredientId: string, request: { intent: SwapIntent; replacement?: string }) => void;
};

export default function IngredientList({ ingredients, swapDisabled, formatAmount, onSwapIngredient }: Props) {
  return (
    <div className="space-y-3">
      {ingredients.map((ing) => (
        <IngredientRow
          key={ing.id}
          ingredient={ing}
          amount={formatAmount ? formatAmount(ing.amount) : ing.amount}
          swapDisabled={swapDisabled}
          onSwap={(request) => onSwapIngredient(ing.id, request)}
        />
      ))}
    </div>
  );
}
