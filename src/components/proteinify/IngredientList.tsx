"use client";

import type { Ingredient } from "@/lib/proteinify/types";
import IngredientRow from "./IngredientRow";

type Props = {
  ingredients: Ingredient[];
  swapDisabled?: boolean;
  onSwapIngredient: (ingredientId: string, replacement: string) => void;
  deltaPerIngredient?: number;
};

export default function IngredientList({ ingredients, swapDisabled, onSwapIngredient, deltaPerIngredient }: Props) {
  return (
    <div className="space-y-3">
      {ingredients.map((ing) => (
        <IngredientRow
          key={ing.id}
          ingredient={ing}
          swapDisabled={swapDisabled}
          deltaPerIngredient={deltaPerIngredient}
          onSwap={(replacement) => onSwapIngredient(ing.id, replacement)}
        />
      ))}
    </div>
  );
}

