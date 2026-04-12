import type { RecipeVersion, TransformationMode } from "./types";

/** UI label for a version row (Lean mode renames the third tier to “Fully Light”). */
export function displayVersionLabel(
  version: RecipeVersion,
  transformationMode: TransformationMode
): string {
  if (transformationMode === "lean" && version.id === "max-protein") return "Fully Light";
  return version.label;
}
