// src/lib/culinary/dil/loader.ts
// FIX: indexes derived from data at load time (no hardcoding in promptBuilder);
// alias collision detection; validateDILIntegrity with cross-reference checks.

import { createRequire } from "node:module";
import { z } from "zod";

// Load JSON via require() — `import … assert/with { type: "json" }` and some ESM JSON
// imports crash in Vercel's serverless Node before the handler runs.
const require = createRequire(import.meta.url);
const dishDNAData: unknown = require("./data/dishDNA.json");
const swapGuardsData: unknown = require("./data/swapGuards.json");

import {
  DishDNA,
  SwapGuard,
  type CookingMethodId,
  type CuisineZoneId,
} from "./schemas";

// ─── Parse + validate at load time ───────────────────────────────────────────
// FIX (Sundar): z.parse() is synchronous and fine for small datasets.
// At 500+ dishes, move this to a build-step pre-validation script and
// import the pre-typed output instead. For now this is appropriate for Sprint 0.

const parseResult = z.array(DishDNA).safeParse(dishDNAData);
if (!parseResult.success) {
  const issues = parseResult.error.issues
    .map(i => `  [${i.path.join(".")}] ${i.message}`)
    .join("\n");
  throw new Error(`DIL: dishDNA.json failed schema validation:
${issues}`);
}
export const allDishes: DishDNA[] = parseResult.data;

const guardsResult = z.array(SwapGuard).safeParse(swapGuardsData);
if (!guardsResult.success) {
  const issues = guardsResult.error.issues
    .map(i => `  [${i.path.join(".")}] ${i.message}`)
    .join("\n");
  throw new Error(`DIL: swapGuards.json failed schema validation:
${issues}`);
}
export const allSwapGuards: SwapGuard[] = guardsResult.data;

// ─── Primary lookup index ─────────────────────────────────────────────────────

const dishById = new Map<string, DishDNA>(
  allDishes.map(d => [d.id, d])
);

// FIX (Sundar): alias collision detection.
// Previous implementation used last-write-wins silently.
// Now we log a warning and keep the first mapping.
const aliasMap = new Map<string, string>();

for (const dish of allDishes) {
  for (const alias of dish.dishAliases) {
    const key = alias.toLowerCase().trim();
    if (aliasMap.has(key)) {
      const existing = aliasMap.get(key)!;
      if (existing !== dish.id) {
        console.warn(
          `DIL alias collision: "${alias}" maps to both "${existing}" and "${dish.id}". ` +
          `Keeping "${existing}". Fix dishAliases in dishDNA.json.`
        );
      }
    } else {
      aliasMap.set(key, dish.id);
    }
  }
  // also index by id directly
  aliasMap.set(dish.id.toLowerCase().trim(), dish.id);
}

// ─── Guard indexes ─────────────────────────────────────────────────────────────
// FIX (Sundar): previously promptBuilder.ts hardcoded guard codes as a literal array.
// Any new guard added to swapGuards.json was silently invisible to the LLM.
// Now guards are indexed at load time; promptBuilder derives codes from these maps.

export const guardsByDishId = new Map<string, SwapGuard[]>();
export const guardsByMethod = new Map<CookingMethodId, SwapGuard[]>();
export const guardsByZone = new Map<CuisineZoneId, SwapGuard[]>();

for (const guard of allSwapGuards) {
  const { constraints } = guard;

  constraints.bannedDishes?.forEach(dishId => {
    if (!guardsByDishId.has(dishId)) guardsByDishId.set(dishId, []);
    guardsByDishId.get(dishId)!.push(guard);
  });

  constraints.bannedMethods?.forEach(method => {
    if (!guardsByMethod.has(method)) guardsByMethod.set(method, []);
    guardsByMethod.get(method)!.push(guard);
  });

  constraints.bannedZones?.forEach(zone => {
    if (!guardsByZone.has(zone)) guardsByZone.set(zone, []);
    guardsByZone.get(zone)!.push(guard);
  });
}

/**
 * Returns all guards relevant to a given dish, deduplicated.
 * Used by promptBuilder and validator — single source of truth for which
 * guards apply, so promptBuilder never needs to hardcode codes again.
 */
export function getGuardsForDish(dish: DishDNA): SwapGuard[] {
  const seen = new Set<string>();
  const result: SwapGuard[] = [];

  const add = (guards: SwapGuard[] | undefined) => {
    guards?.forEach(g => {
      if (!seen.has(g.code)) {
        seen.add(g.code);
        result.push(g);
      }
    });
  };

  add(guardsByDishId.get(dish.id));
  add(guardsByMethod.get(dish.identityMethod));
  add(guardsByZone.get(dish.cuisineZone));

  return result;
}

// ─── Public lookup API ────────────────────────────────────────────────────────

/**
 * Looks up a dish by exact ID or by alias (fuzzy-tolerant normalisation).
 * Returns null if no match found — caller handles fallback.
 */
export function getDishByIdOrAlias(input: string): DishDNA | null {
  const clean = input.toLowerCase().trim();

  // 1. Direct alias / id map hit
  const id = aliasMap.get(clean);
  if (id) return dishById.get(id) ?? null;

  // 2. Partial substring match (last resort — catches "make me a biryani" style input)
  for (const [alias, dishId] of aliasMap.entries()) {
    if (clean.includes(alias) || alias.includes(clean)) {
      return dishById.get(dishId) ?? null;
    }
  }

  return null;
}

// ─── Build-time integrity check ───────────────────────────────────────────────

export function validateDILIntegrity(): void {
  const errors: string[] = [];

  for (const dish of allDishes) {
    // 1. identityMethod must be in at least one cookingArc sequence
    const allArcMethods = dish.cookingArcs.flatMap(arc => arc.sequence);
    if (!allArcMethods.includes(dish.identityMethod)) {
      errors.push(
        `[${dish.id}] identityMethod "${dish.identityMethod}" not present in any cookingArc sequence`
      );
    }

    // 2. schemaVersion must be parseable as a date
    const d = Date.parse(dish.schemaVersion);
    if (isNaN(d)) {
      errors.push(`[${dish.id}] schemaVersion "${dish.schemaVersion}" is not a valid date string`);
    }

    // 3. dishAliases must not be empty
    if (dish.dishAliases.length === 0) {
      errors.push(`[${dish.id}] dishAliases is empty — getDishByIdOrAlias will never match user input`);
    }

    // 4. at least one textureContrast component must appear in textureProfile
    const { primary, secondary } = dish.textureContrast;
    if (!dish.textureProfile.includes(primary.texture)) {
      errors.push(
        `[${dish.id}] textureContrast.primary.texture "${primary.texture}" not in textureProfile`
      );
    }
    if (!dish.textureProfile.includes(secondary.texture)) {
      errors.push(
        `[${dish.id}] textureContrast.secondary.texture "${secondary.texture}" not in textureProfile`
      );
    }

    // 5. hasMarinade flag must be consistent with acidAnchor stages
    const hasPreCookAcid = dish.acidAnchor.some(a => a.stage === "pre-cook");
    if (dish.hasMarinade && !hasPreCookAcid) {
      errors.push(
        `[${dish.id}] hasMarinade is true but no acidAnchor entry has stage "pre-cook"`
      );
    }
  }

  // 6. Every bannedDish in every guard should exist in dishById.
  // Sprint-ordered rollout can temporarily reference future dishes; warn instead
  // of hard-failing startup so existing dishes remain operational.
  const warnings: string[] = [];
  for (const guard of allSwapGuards) {
    guard.constraints.bannedDishes?.forEach(dishId => {
      if (!dishById.has(dishId)) {
        warnings.push(
          `[guard:${guard.code}] bannedDish "${dishId}" does not exist in dishDNA.json`
        );
      }
    });
  }

  if (errors.length > 0) {
    throw new Error(`DIL integrity check failed:
${errors.map(e => `  • ${e}`).join("\n")}`);
  }

  if (warnings.length > 0) {
    console.warn(
      `DIL integrity warnings:\n${warnings.map(w => `  • ${w}`).join("\n")}`
    );
  }

  console.log(`✅ DIL integrity passed — ${allDishes.length} dishes, ${allSwapGuards.length} guards`);
}
