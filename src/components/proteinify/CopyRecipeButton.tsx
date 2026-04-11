"use client";

import type { RecipeVersion } from "@/lib/proteinify/types";
import { humanizeIngredientDisplay } from "./humanizeIngredientDisplay";

type Props = {
  dishLabel: string;
  version: RecipeVersion;
};

function buildRecipeText(dishLabel: string, version: RecipeVersion) {
  const lines: string[] = [];
  lines.push(`${version.label}: ${dishLabel}`);
  lines.push("");
  lines.push(humanizeIngredientDisplay(version.summary));
  lines.push("");
  lines.push("What changed (by component)");
  const t = version.transformationByComponent;
  const slots: [string, string[]][] = [
    ["Protein", t.protein],
    ["Carb base", t.carbBase],
    ["Sauce / broth", t.sauceBroth],
    ["Fat", t.fat],
    ["Toppings", t.toppings],
  ];
  for (const [label, items] of slots) {
    const hit = items.filter((x) => x.trim()).map((x) => humanizeIngredientDisplay(x));
    lines.push(hit.length ? `${label}: ${hit.join(" · ")}` : `${label}: (no change)`);
  }
  lines.push("");
  lines.push("How to apply");
  version.methodAdjustments.forEach((s, i) =>
    lines.push(`${i + 1}. ${humanizeIngredientDisplay(s)}`)
  );
  lines.push("");
  const totalP = version.totalProteinG ?? version.macros.p;
  const baselineP = Math.max(0, version.macros.p - version.macros.d);
  const deltaP = Math.round(totalP - baselineP);
  lines.push(
    `Protein per serving: ${baselineP}g baseline → ${totalP}g after (${deltaP >= 0 ? `+${deltaP}g` : `${deltaP}g`} delta).`
  );
  lines.push("Proteinify shows protein only — not calories, fat, or carbs.");
  lines.push("");
  lines.push("Ingredients (full list):");
  for (const ing of version.ingredients) {
    const note = ing.reason?.trim() ? ` — ${humanizeIngredientDisplay(ing.reason)}` : "";
    lines.push(
      `- ${humanizeIngredientDisplay(ing.amount)} ${humanizeIngredientDisplay(ing.current)}${note}`
    );
  }
  lines.push("");
  lines.push("Full method:");
  for (const step of version.steps) {
    lines.push(`- ${humanizeIngredientDisplay(step)}`);
  }
  lines.push("");
  if (version.adds.length > 0) {
    lines.push("Additions:");
    for (const a of version.adds) {
      lines.push(`- ${a.note}`);
    }
    lines.push("");
  }
  lines.push(`Why this works: ${humanizeIngredientDisplay(version.why)}`);
  return lines.join("\n");
}

export default function CopyRecipeButton({ dishLabel, version }: Props) {
  return (
    <button
      type="button"
      onClick={async () => {
        const text = buildRecipeText(dishLabel, version);
        await navigator.clipboard.writeText(text);
      }}
      className="rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--accent-light)] hover:text-[color:var(--accent)]"
    >
      Copy recipe
    </button>
  );
}

