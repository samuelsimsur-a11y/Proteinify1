import type { TransformationByComponent } from "@/lib/proteinify/types";

export const COMPONENT_SLOTS: {
  key: keyof TransformationByComponent;
  label: string;
  hint: string;
  /** Small scan aid — keep one character / emoji only */
  mark: string;
  /** Tailwind colour for a tiny dot beside the label */
  dotClass: string;
}[] = [
  {
    key: "protein",
    label: "Protein",
    hint: "Anchor meat, eggs, legumes, dairy-protein",
    mark: "🥩",
    dotClass: "bg-[#C45C3E]",
  },
  {
    key: "carbBase",
    label: "Carb base",
    hint: "Noodles, rice, bread, wraps",
    mark: "🍚",
    dotClass: "bg-[#D4A84B]",
  },
  {
    key: "sauceBroth",
    label: "Sauce / broth",
    hint: "Liquid lane, soup, curry, reduction",
    mark: "🍜",
    dotClass: "bg-[#4A7AB8]",
  },
  {
    key: "fat",
    label: "Fat",
    hint: "Oils, butter, cream, aroma oil, cheese melt",
    mark: "🫒",
    dotClass: "bg-[#C9A227]",
  },
  {
    key: "toppings",
    label: "Toppings",
    hint: "Herbs, pickles, crunch, finishers",
    mark: "🥬",
    dotClass: "bg-[#5A9A6E]",
  },
];

export function slotHasContent(lines: string[]): boolean {
  return lines.some((l) => l.trim().length > 0 && !/^unchanged\.?$/i.test(l.trim()));
}

export function getSlotLines(
  component: TransformationByComponent,
  key: keyof TransformationByComponent
): string[] {
  return component[key].filter(
    (l) => l.trim().length > 0 && !/^unchanged\.?$/i.test(l.trim())
  );
}
