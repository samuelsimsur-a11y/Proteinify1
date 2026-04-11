import type {
  AdditionItem,
  Ingredient,
  IngredientSwapOption,
  ProteinifyResponse,
  RecipeVersion,
  TransformationByComponent,
  TransformationMode,
} from "@/lib/proteinify/types";
import { parseProteinifyResponseJson, type ParseResult } from "@/lib/proteinify/parseResponse";

import {
  isTechniqueCode,
  SWAP_LIBRARY,
  type TechniqueCode,
} from "./swapLibrary";

export type CompactSwap = {
  code: TechniqueCode;
  amount: string;
  target: string;
  proteinDelta: number;
};

export type CompactAdd = {
  code: TechniqueCode;
  amount: string;
};

export type CompactVersion = {
  id: RecipeVersion["id"];
  priorities: string[];
  swaps: CompactSwap[];
  adds: CompactAdd[];
  macros: { p: number; d: number; cal: number };
  summaryOneLiner: string;
  whyOneLiner: string;
};

export type CompactResult = {
  inputDish: string;
  assumptions: string[];
  identityScore: number;
  fatVehicle: string;
  acidAnchor: string;
  versions: [CompactVersion, CompactVersion, CompactVersion];
};

export type StreamExpandContext = {
  inputDish: string;
  transformationMode: TransformationMode;
  identityScore?: number;
  fatVehicle?: string;
  acidAnchor?: string;
};

/** Best-effort parse of root fields from an incomplete JSON buffer (streaming SSE). */
export function peekStreamCompactRootContext(
  buffer: string
): Partial<Pick<StreamExpandContext, "identityScore" | "fatVehicle" | "acidAnchor" | "inputDish">> {
  const identityScore = (() => {
    const m = /"identityScore"\s*:\s*(-?[\d.]+)/.exec(buffer);
    if (!m) return undefined;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : undefined;
  })();
  const fatVehicle = (() => {
    const m = /"fatVehicle"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(buffer);
    return m?.[1]?.replace(/\\"/g, '"') ?? undefined;
  })();
  const acidAnchor = (() => {
    const m = /"acidAnchor"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(buffer);
    return m?.[1]?.replace(/\\"/g, '"') ?? undefined;
  })();
  const inputDish = (() => {
    const m = /"inputDish"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(buffer);
    return m?.[1]?.replace(/\\"/g, '"') ?? undefined;
  })();
  return { identityScore, fatVehicle, acidAnchor, inputDish };
}

type ExpandCtx = {
  dish: string;
  identityScore: number;
  fatVehicle: string;
  acidAnchor: string;
  transformationMode: TransformationMode;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isString(x: unknown): x is string {
  return typeof x === "string";
}

function isNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function thirdLabel(mode: TransformationMode): RecipeVersion["label"] {
  return mode === "lean" ? "Fully Light" : "Full Send";
}

function versionLabel(id: RecipeVersion["id"], mode: TransformationMode): RecipeVersion["label"] {
  if (id === "close-match") return "Close Match";
  if (id === "balanced") return "Balanced";
  return thirdLabel(mode);
}

function versionScores(id: RecipeVersion["id"], identityScore: number): Pick<
  RecipeVersion,
  "tasteScore" | "realismScore" | "aggressivenessScore"
> {
  const i = Math.max(0, Math.min(10, identityScore));
  if (id === "close-match") {
    return {
      tasteScore: Math.round(Math.min(10, 8 + i * 0.15)),
      realismScore: Math.round(Math.min(10, 8.5 + i * 0.05)),
      aggressivenessScore: Math.round(Math.max(0, 3 - i * 0.15)),
    };
  }
  if (id === "balanced") {
    return {
      tasteScore: Math.round(6.5 + i * 0.2),
      realismScore: Math.round(6.5 + i * 0.15),
      aggressivenessScore: Math.round(4 + i * 0.2),
    };
  }
  return {
    tasteScore: Math.round(5.5 + i * 0.15),
    realismScore: Math.round(4.5 + i * 0.2),
    aggressivenessScore: Math.round(Math.min(10, 7 + i * 0.25)),
  };
}

function interpolate(
  template: string,
  vars: { dish: string; target: string; amount: string; fatVehicle: string; acidAnchor: string }
): string {
  return template
    .replace(/\{dish\}/g, vars.dish)
    .replace(/\{target\}/g, vars.target)
    .replace(/\{amount\}/g, vars.amount)
    .replace(/\{fatVehicle\}/g, vars.fatVehicle)
    .replace(/\{acidAnchor\}/g, vars.acidAnchor);
}

function cannedSwapOptions(currentLabel: string): IngredientSwapOption[] {
  return [
    {
      type: "higher-protein",
      label: "Push protein harder",
      replacement: `Increase portion or stack a second approved booster on ${currentLabel}`,
      effect: "More protein; may move texture or satiety.",
    },
    {
      type: "more-authentic",
      label: "More traditional",
      replacement: "Reduce the modification and lean on marinade or broth amplification only",
      effect: "Closer to classic identity with smaller protein delta.",
    },
    {
      type: "more-common",
      label: "Pantry simpler",
      replacement: "Swap to egg, Greek yogurt, or beans only — drop powders if any",
      effect: "More familiar shopping list.",
    },
    {
      type: "simpler",
      label: "Fewer steps",
      replacement: "Keep only the top one or two swaps for this version",
      effect: "Easier execution; smaller gain.",
    },
  ];
}

function orderedTechniqueCodes(priorities: string[], swaps: CompactSwap[]): TechniqueCode[] {
  const out: TechniqueCode[] = [];
  const seen = new Set<TechniqueCode>();
  for (const p of priorities) {
    if (isTechniqueCode(p) && !seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  for (const s of swaps) {
    if (isTechniqueCode(s.code) && !seen.has(s.code)) {
      seen.add(s.code);
      out.push(s.code);
    }
  }
  return out;
}

function buildSteps(
  cv: CompactVersion,
  root: ExpandCtx,
  usedCodes: TechniqueCode[]
): string[] {
  const steps: string[] = [];
  const dish = root.dish;

  for (const tag of cv.priorities) {
    if (!isTechniqueCode(tag)) {
      steps.push(`Priority: ${tag} — keep the dish's texture contract while applying later technique codes.`);
    }
  }

  for (const code of usedCodes) {
    const entry = SWAP_LIBRARY[code];
    const swapRow = cv.swaps.find((s) => s.code === code);
    const target = (swapRow?.target?.trim() || entry.defaultTarget).trim();
    const amount = (swapRow?.amount?.trim() || entry.defaultAmount).trim();
    const text = interpolate(entry.technique, {
      dish,
      target,
      amount,
      fatVehicle: root.fatVehicle,
      acidAnchor: root.acidAnchor,
    });
    steps.push(text);
    if (entry.heatWarning) steps.push(`Heat guard: ${entry.heatWarning}`);
    if (entry.textureWarning) steps.push(`Texture note: ${entry.textureWarning}`);
  }

  if (steps.length === 0) {
    steps.push(
      `Prepare ${dish} using classic technique; honor fat vehicle (${root.fatVehicle}) and keep protein additions minimal for this tier.`
    );
  }

  steps.push(
    `Taste and finish: brighten with ${root.acidAnchor} where the dish expects balance after any protein boost.`
  );

  return steps.slice(0, 12);
}

function swapToIngredient(
  swap: CompactSwap,
  index: number,
  versionId: RecipeVersion["id"],
  root: ExpandCtx
): Ingredient {
  const entry = SWAP_LIBRARY[swap.code];
  const target = swap.target.trim() || entry.defaultTarget;
  const amount = swap.amount.trim() || entry.defaultAmount;
  const current = `${entry.note} (${amount})`;
  const reason = [
    entry.proteinNote,
    `Estimated +${swap.proteinDelta}g protein from this move.`,
    entry.textureWarning,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: `ing-${versionId}-${index}-${swap.code}`,
    original: target,
    current,
    amount,
    reason,
    swapOptions: cannedSwapOptions(entry.note),
    estimated: true,
  };
}

function addToAddition(ca: CompactAdd): AdditionItem {
  const entry = SWAP_LIBRARY[ca.code];
  const amt = ca.amount.trim();
  const note = amt ? `${entry.note} — ${amt}` : entry.note;
  return { note };
}

export function expandCompactVersion(cv: CompactVersion, root: ExpandCtx): RecipeVersion {
  const usedCodes = orderedTechniqueCodes(cv.priorities, cv.swaps);
  const ingredients: Ingredient[] = cv.swaps.map((s, i) => swapToIngredient(s, i, cv.id, root));

  if (ingredients.length === 0) {
    ingredients.push({
      id: `ing-${cv.id}-base`,
      original: "baseline build",
      current: `Core ${root.dish} preparation`,
      amount: "per classic method",
      reason: `Identity-forward tier: prioritize honest portions and technique over substitutions (${root.fatVehicle} preserved).`,
      swapOptions: cannedSwapOptions("baseline"),
      estimated: true,
    });
  }

  const adds: AdditionItem[] = cv.adds.map(addToAddition);
  const steps = buildSteps(cv, root, usedCodes);

  const p = Math.max(0, cv.macros.p);
  const d = Math.max(0, cv.macros.d);

  const transformationByComponent: TransformationByComponent = {
    protein: cv.swaps.slice(0, 4).map((s) => `${s.target} → ${s.code}`),
    carbBase: [],
    sauceBroth: [],
    fat: [],
    toppings: [],
  };
  const methodAdjustments =
    steps.length >= 2
      ? steps.slice(0, Math.min(6, steps.length))
      : ["Apply the listed technique swaps in order.", "Taste and adjust seasoning before serving."];

  return {
    id: cv.id,
    label: versionLabel(cv.id, root.transformationMode),
    summary: cv.summaryOneLiner.trim(),
    why: cv.whyOneLiner.trim(),
    macros: { p, d },
    ...versionScores(cv.id, root.identityScore),
    adds: adds.slice(0, 3),
    transformationByComponent,
    methodAdjustments,
    ingredients,
    steps,
  };
}

export function expandCompactResult(
  compact: CompactResult,
  transformationMode: TransformationMode
): ProteinifyResponse {
  const root: ExpandCtx = {
    dish: compact.inputDish.trim() || "the dish",
    identityScore: Math.max(0, Math.min(10, compact.identityScore)),
    fatVehicle: compact.fatVehicle.trim() || "the dish fat vehicle",
    acidAnchor: compact.acidAnchor.trim() || "finishing acid",
    transformationMode,
  };

  const v0 = expandCompactVersion(compact.versions[0], root);
  const v1 = expandCompactVersion(compact.versions[1], root);
  const v2 = expandCompactVersion(compact.versions[2], root);

  return {
    inputDish: compact.inputDish.trim(),
    assumptions: compact.assumptions.map((a) => a.trim()).filter(Boolean),
    versions: [v0, v1, v2] as [RecipeVersion, RecipeVersion, RecipeVersion],
  };
}

function parseCompactSwap(raw: unknown): CompactSwap | null {
  if (!isRecord(raw)) return null;
  const code = raw.code;
  const amount = raw.amount;
  const target = raw.target;
  const proteinDelta = raw.proteinDelta;
  if (!isString(code) || !isTechniqueCode(code)) return null;
  if (!isString(amount) || !isString(target)) return null;
  if (!isNumber(proteinDelta)) return null;
  return { code, amount, target, proteinDelta };
}

function parseCompactAdd(raw: unknown): CompactAdd | null {
  if (!isRecord(raw)) return null;
  const code = raw.code;
  const amount = raw.amount;
  if (!isString(code) || !isTechniqueCode(code)) return null;
  if (!isString(amount)) return null;
  return { code, amount };
}

function parseCompactVersion(raw: unknown): CompactVersion | null {
  if (!isRecord(raw)) return null;
  const id = raw.id;
  const priorities = raw.priorities;
  const swaps = raw.swaps;
  const adds = raw.adds;
  const macros = raw.macros;
  const summaryOneLiner = raw.summaryOneLiner;
  const whyOneLiner = raw.whyOneLiner;

  if (id !== "close-match" && id !== "balanced" && id !== "max-protein") return null;
  if (!Array.isArray(priorities) || priorities.length < 1) return null;
  if (!Array.isArray(swaps) || !Array.isArray(adds)) return null;
  if (!isRecord(macros)) return null;
  if (!isString(summaryOneLiner) || !isString(whyOneLiner)) return null;

  const pr: string[] = [];
  for (const p of priorities) {
    if (!isString(p) || !p.trim()) return null;
    pr.push(p.trim());
  }

  const sw: CompactSwap[] = [];
  for (const s of swaps) {
    const ps = parseCompactSwap(s);
    if (!ps) return null;
    sw.push(ps);
  }

  const ad: CompactAdd[] = [];
  for (const a of adds) {
    const pa = parseCompactAdd(a);
    if (!pa) return null;
    ad.push(pa);
  }

  const p = macros.p;
  const d = macros.d;
  const cal = macros.cal;
  if (!isNumber(p) || !isNumber(d) || !isNumber(cal)) return null;
  if (p < 0 || d < 0) return null;

  return {
    id,
    priorities: pr,
    swaps: sw,
    adds: ad,
    macros: { p, d, cal },
    summaryOneLiner,
    whyOneLiner,
  };
}

export function parseCompactResultJson(json: unknown): { ok: true; data: CompactResult } | { ok: false; error: string } {
  if (!isRecord(json)) return { ok: false, error: "Compact payload is not an object." };

  const inputDish = json.inputDish;
  const assumptions = json.assumptions;
  const identityScore = json.identityScore;
  const fatVehicle = json.fatVehicle;
  const acidAnchor = json.acidAnchor;
  const versions = json.versions;

  if (!isString(inputDish)) return { ok: false, error: "Missing inputDish." };
  if (!Array.isArray(assumptions)) return { ok: false, error: "Missing assumptions." };
  if (!isNumber(identityScore)) return { ok: false, error: "Missing identityScore." };
  if (!isString(fatVehicle) || !isString(acidAnchor)) return { ok: false, error: "Missing fatVehicle or acidAnchor." };
  if (!Array.isArray(versions) || versions.length !== 3) return { ok: false, error: "versions must have length 3." };

  const asm: string[] = [];
  for (const a of assumptions) {
    if (!isString(a)) return { ok: false, error: "Invalid assumptions entry." };
    asm.push(a);
  }

  const v0 = parseCompactVersion(versions[0]);
  const v1 = parseCompactVersion(versions[1]);
  const v2 = parseCompactVersion(versions[2]);
  if (!v0 || !v1 || !v2) return { ok: false, error: "Invalid compact version object." };
  if (v0.id !== "close-match" || v1.id !== "balanced" || v2.id !== "max-protein") {
    return { ok: false, error: "versions must be close-match, balanced, max-protein in order." };
  }

  return {
    ok: true,
    data: {
      inputDish,
      assumptions: asm,
      identityScore,
      fatVehicle,
      acidAnchor,
      versions: [v0, v1, v2],
    },
  };
}

export function parseCompactSingleResponseJson(
  json: unknown
): { ok: true; data: Omit<CompactResult, "versions"> & { version: CompactVersion } } | { ok: false; error: string } {
  if (!isRecord(json)) return { ok: false, error: "Compact payload is not an object." };

  const inputDish = json.inputDish;
  const assumptions = json.assumptions;
  const identityScore = json.identityScore;
  const fatVehicle = json.fatVehicle;
  const acidAnchor = json.acidAnchor;
  const version = json.version;

  if (!isString(inputDish)) return { ok: false, error: "Missing inputDish." };
  if (!Array.isArray(assumptions)) return { ok: false, error: "Missing assumptions." };
  if (!isNumber(identityScore)) return { ok: false, error: "Missing identityScore." };
  if (!isString(fatVehicle) || !isString(acidAnchor)) return { ok: false, error: "Missing fatVehicle or acidAnchor." };

  const asm: string[] = [];
  for (const a of assumptions) {
    if (!isString(a)) return { ok: false, error: "Invalid assumptions entry." };
    asm.push(a);
  }

  const v = parseCompactVersion(version);
  if (!v) return { ok: false, error: "Invalid compact version." };

  return {
    ok: true,
    data: {
      inputDish,
      assumptions: asm,
      identityScore,
      fatVehicle,
      acidAnchor,
      version: v,
    },
  };
}

function streamCtxToExpandCtx(stream: StreamExpandContext): ExpandCtx {
  return {
    dish: stream.inputDish.trim() || "the dish",
    identityScore: stream.identityScore !== undefined ? Math.max(0, Math.min(10, stream.identityScore)) : 7,
    fatVehicle: stream.fatVehicle?.trim() || "the dish fat vehicle",
    acidAnchor: stream.acidAnchor?.trim() || "finishing acid",
    transformationMode: stream.transformationMode,
  };
}

/** Expand one compact version object (e.g. from SSE streaming) with optional partial root context. */
export function expandCompactVersionFromUnknown(
  raw: unknown,
  stream: StreamExpandContext
): RecipeVersion | null {
  const cv = parseCompactVersion(raw);
  if (!cv) return null;
  return expandCompactVersion(cv, streamCtxToExpandCtx(stream));
}

/**
 * Parse model JSON, validate compact shape, expand to full wire, then run existing parser for safety.
 */
export function parseExpandAndValidateProteinify(
  json: unknown,
  transformationMode: TransformationMode
): ParseResult {
  const compact = parseCompactResultJson(json);
  if (!compact.ok) return { ok: false, error: compact.error };

  const expanded = expandCompactResult(compact.data, transformationMode);
  return parseProteinifyResponseJson(expanded);
}

export function mergeSingleCompactVersion(
  json: unknown,
  targetVersion: RecipeVersion["id"],
  previous: ProteinifyResponse,
  transformationMode: TransformationMode
): ParseResult {
  const parsed = parseCompactSingleResponseJson(json);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  if (parsed.data.version.id !== targetVersion) {
    return { ok: false, error: `Compact version id must be "${targetVersion}".` };
  }

  const root: ExpandCtx = {
    dish: parsed.data.inputDish.trim() || previous.inputDish,
    identityScore: Math.max(0, Math.min(10, parsed.data.identityScore)),
    fatVehicle: parsed.data.fatVehicle.trim() || "the dish fat vehicle",
    acidAnchor: parsed.data.acidAnchor.trim() || "finishing acid",
    transformationMode,
  };

  const v = expandCompactVersion(parsed.data.version, root);

  const idx = targetVersion === "close-match" ? 0 : targetVersion === "balanced" ? 1 : 2;
  const merged: ProteinifyResponse = {
    inputDish: isString(parsed.data.inputDish) && parsed.data.inputDish.trim()
      ? parsed.data.inputDish.trim()
      : previous.inputDish,
    assumptions:
      parsed.data.assumptions.length > 0 ? parsed.data.assumptions : previous.assumptions,
    versions: [
      idx === 0 ? v : previous.versions[0],
      idx === 1 ? v : previous.versions[1],
      idx === 2 ? v : previous.versions[2],
    ],
  };

  return parseProteinifyResponseJson(merged);
}
