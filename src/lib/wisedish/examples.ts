/**
 * Pre-generated results for the example dishes, bundled with the app so a first-time user sees a
 * full result instantly (no 30–60 s wait, no AI cost). Refresh with `npm run bake:examples`.
 */
import baked from "@/data/exampleResults.json";
import { parseWiseDishResponseJson } from "./parseResponse";
import type { TransformationMode, WiseDishResponse } from "./types";

type BakedFile = {
  version: number;
  generatedAt: string | null;
  examples: Record<string, unknown>;
};

const file = baked as BakedFile;
const cache = new Map<string, WiseDishResponse | null>();

export function exampleKey(dish: string, mode: TransformationMode): string {
  return `${mode}:${dish.trim().toLowerCase()}`;
}

export function getBakedExample(dish: string, mode: TransformationMode): WiseDishResponse | null {
  const key = exampleKey(dish, mode);
  if (cache.has(key)) return cache.get(key)!;
  const raw = file.examples?.[key];
  let parsed: WiseDishResponse | null = null;
  if (raw) {
    const r = parseWiseDishResponseJson(raw);
    if ("ok" in r && r.ok) parsed = r.data;
  }
  cache.set(key, parsed);
  return parsed;
}

/** Biggest protein gain across the three versions, for "+34g protein" style hero chips. */
export function bestProteinGain(response: WiseDishResponse | null): number | null {
  if (!response) return null;
  const gains = response.versions.map((v) => v.macros.d).filter((d) => Number.isFinite(d));
  if (gains.length === 0) return null;
  return Math.round(Math.max(...gains));
}
