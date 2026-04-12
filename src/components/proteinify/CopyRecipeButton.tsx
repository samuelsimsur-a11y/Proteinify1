"use client";

import type { RecipeVersion, TransformationMode } from "@/lib/proteinify/types";
import { displayVersionLabel } from "@/lib/proteinify/displayVersionLabel";
import { humanizeIngredientDisplay } from "./humanizeIngredientDisplay";
import { useEffect, useState } from "react";

type Props = {
  dishLabel: string;
  version: RecipeVersion;
  transformationMode: TransformationMode;
};

function buildRecipeText(dishLabel: string, version: RecipeVersion, transformationMode: TransformationMode) {
  const lines: string[] = [];
  lines.push(`${displayVersionLabel(version, transformationMode)}: ${dishLabel}`);
  lines.push("");
  lines.push(humanizeIngredientDisplay(version.summary));
  lines.push("");
  lines.push(`Cook time (estimate): ~${version.cookTimeMinutes} min · Difficulty: ${version.difficulty}`);
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

export default function CopyRecipeButton({ dishLabel, version, transformationMode }: Props) {
  const [toastVisible, setToastVisible] = useState(false);
  const [toastFading, setToastFading] = useState(false);
  const [toastSeq, setToastSeq] = useState(0);

  useEffect(() => {
    if (!toastVisible) return;
    const fadeTimer = window.setTimeout(() => setToastFading(true), 2000);
    const hideTimer = window.setTimeout(() => {
      setToastVisible(false);
      setToastFading(false);
    }, 2350);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [toastVisible, toastSeq]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={async () => {
          const text = buildRecipeText(dishLabel, version, transformationMode);
          await navigator.clipboard.writeText(text);
          setToastSeq((s) => s + 1);
          setToastFading(false);
          setToastVisible(true);
        }}
        className="rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--accent-light)] hover:text-[color:var(--accent)]"
      >
        Copy recipe
      </button>
      {toastVisible ? (
        <div
          key={toastSeq}
          role="status"
          aria-live="polite"
          className={[
            "pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-4 py-2 text-xs font-semibold text-[color:var(--text-primary)] shadow-lg transition-opacity duration-300",
            toastFading ? "opacity-0" : "opacity-100",
          ].join(" ")}
        >
          Copied!
        </div>
      ) : null}
    </div>
  );
}
