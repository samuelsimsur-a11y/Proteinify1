#!/bin/bash
# Paste this entire script into your terminal inside the proteinify folder.
# It creates every folder and file automatically.

mkdir -p src/lib/culinary/dil/data
mkdir -p src/lib/culinary/dil/tests
mkdir -p src/app/api/generate

cat > .cursorrules << 'ENDOFFILE'
# DIL — Dish Identity Library: Cursor Rules

## What this codebase is

This is a **Culinary Grammar Engine**. It enforces cultural and physical cooking rules
on LLM-generated recipe modifications. The pipeline is:

```
user input → getDishByIdOrAlias() → buildAPIPayload() → Anthropic API (tool_use forced)
→ extractSwapsFromResponse() → validateSwap() → expansion
```

All files live in `src/lib/culinary/dil/`. Never import from internal modules directly —
always import from `index.ts`.

---

## File responsibilities

| File | Job | Touch when |
|------|-----|-----------|
| `schemas.ts` | Zod types — single source of truth | Adding a new field to any entity |
| `loader.ts` | Parse JSON, build indexes, integrity check | Never, unless adding a new data file |
| `promptBuilder.ts` | Build system prompt + Anthropic tool definition | Changing how constraints are communicated to the LLM |
| `validator.ts` | Run guards against proposed swap codes | Adding new violation logic |
| `data/dishDNA.json` | Dish entries | Adding or editing a dish |
| `data/swapGuards.json` | Guard rules | Adding or editing a guard |
| `tests/golden-regression.json` | Known failure cases | Every time a dish or guard is added |

---

## Rules for adding a new dish to dishDNA.json

Every dish entry MUST have all of these fields. Do not omit any.

### cookingArcs — ALWAYS multi-track, never a flat array

```json
"cookingArcs": [
  {
    "track": "protein",
    "sequence": ["saute", "braise"],
    "mergeAt": "plating"
  },
  {
    "track": "assembly",
    "sequence": ["simmerstew"]
  }
]
```

- Each distinct preparation thread is its own track
- `mergeAt` names the convergence point when two tracks combine
- `identityMethod` must appear in at least one track's `sequence` — `validateDILIntegrity()` will throw if not

### fatVehicle — ALWAYS an array of stage-aware entries

```json
"fatVehicle": [
  { "name": "olive oil", "thermalPoint": "high", "stage": "saute", "role": "frying-medium" },
  { "name": "olive oil", "thermalPoint": "neutral", "stage": "finish", "role": "aromatic-finish" }
]
```

- Never a single object `{ "name": "...", "thermalPoint": "..." }` — that was v2, it's gone
- The same fat can appear multiple times with different stages and roles

### acidAnchor — always include stage + role + pHApprox

```json
"acidAnchor": [
  {
    "ingredient": "lime juice",
    "stage": "at-table",
    "role": "brightness",
    "pHApprox": 2.4,
    "concentrationPct": 5,
    "proteinEffect": "brightens"
  }
]
```

- `stage` is load-bearing: "pre-cook" acid tenderises protein; "at-table" acid is brightness only
- `concentrationPct` and `contactTimeMinutes` are optional but include them when known

### textureContrast — ALWAYS component-mapped, never a tuple

```json
"textureContrast": {
  "primary": { "component": "noodle", "texture": "silky" },
  "secondary": { "component": "protein", "texture": "tender" }
}
```

- Never `"textureContrast": ["silky", "tender"]` — that was v2
- Both `primary.texture` and `secondary.texture` must appear in `textureProfile`

### physicsConstraints — always all three flags

```json
"physicsConstraints": {
  "moistureSensitive": true,
  "heatTransferCritical": false,
  "acidTimingSensitive": true
}
```

- `moistureSensitive: true` + a guard with `freeWaterReleaseRisk: "critical"` = automatic physicsviolation
- Never fake a number here — these are boolean facts about the dish's cooking physics

### historicallyAbsent — always include confidence

```json
"historicallyAbsent": [
  {
    "item": "cream sauce",
    "confidence": "definitive",
    "note": "Optional: explain why if contested"
  }
]
```

- `confidence` must be `"definitive"`, `"contested"`, or `"regional"`
- Only `"definitive"` items are used in hard guard checks

### dishAliases — always include common misspellings and natural language variants

```json
"dishAliases": [
  "pad thai noodles",
  "pad thai with chicken",
  "pad-thai",
  "padthai"
]
```

- These feed `getDishByIdOrAlias()` — if the alias isn't here, users won't get a match
- Must be lowercase

### schemaVersion

```json
"schemaVersion": "2026-04-01"
```

- Always today's date in YYYY-MM-DD format when creating or editing an entry
- This is a string, not a number

---

## Rules for adding a new guard to swapGuards.json

### Never hardcode which dishes a guard applies to in promptBuilder.ts

The prompt builder derives guard codes from the indexes in `loader.ts` automatically.
If you add a guard with `"bannedDishes": ["new-dish"]`, it will appear in the prompt
for that dish without any change to `promptBuilder.ts`.

### Always include ingredientPhysics when the ingredient has moisture implications

```json
"ingredientPhysics": {
  "freeWaterReleaseRisk": "critical",
  "textureBehaviorUnderHeat": "mashes"
}
```

- `"critical"` = auto physicsviolation in any `moistureSensitive` dish regardless of other constraints
- `"high"` = blocker above 15% quantity, warning below
- Omit `ingredientPhysics` entirely (or set null) for non-physics guards

### Always include alternativesByGoal for every goal

```json
"alternativesByGoal": {
  "protein-boost": ["..."],
  "vegan": ["..."],
  "lower-calorie": ["..."],
  "lower-fat": ["..."],
  "cultural-coherence": ["..."],
  "general": ["..."]
}
```

- `"general"` is the fallback when no goal is detected
- Do not leave any goal key empty — if you genuinely have nothing, copy the general entry

### Set allowOverride correctly

- `"allowOverride": false` — blocker-level violations the user cannot bypass
- `"allowOverride": true` — warning-level violations where informed user choice is valid

### Set quantityThreshold when the swap is proportional

```json
"quantityThreshold": {
  "blockerAbovePct": 15,
  "warningAbovePct": 5
}
```

- Omit entirely for binary bans (cultural zone violations, vegan identity violations)
- Include for ingredient additions where a small amount might be acceptable

---

## Rules for the validator

### Never use (dish as any)[key]

`mustNotHave` and `mustHave` in guard constraints only accept `DishDNABooleanKey` values:
`"isTraditionallyVegan"`, `"hasMarinade"`, `"dairyPresent"`. That enum is enforced in
`schemas.ts`. Do not add other field names to those arrays.

### Physics violations come from the physics pass, not guard lists

Do not add `"violationIfBroken": "physicsviolation"` to a guard and rely on
`bannedDishes` to fire it. Instead, set `ingredientPhysics.freeWaterReleaseRisk`
on the guard and `physicsConstraints.moistureSensitive: true` on the dish.
The physics pass in `validator.ts` handles it automatically.

---

## Rules for the prompt builder

### Never hardcode guard codes

```ts
// ❌ Wrong — breaks every time a new guard is added
const codes = ["soya-chunks-addition", "cauliflower-rice-swap"];

// ✅ Correct — always current
const codes = getGuardsForDish(dish).map(g => g.code);
```

### Always use the tool_use API, never raw JSON instructions

```ts
// ❌ Wrong — LLM can ignore this
"You MUST respond with JSON only: { appliedSwaps: [...] }"

// ✅ Correct — API enforces the schema structurally
tools: [buildToolDefinition(dish)],
tool_choice: { type: "tool", name: "apply_swap_codes" }
```

---

## Rules for tests

Every new dish or guard requires at minimum:
1. One test case that FAILS validation (a known bad swap)
2. One test case that PASSES validation (a valid empty or acceptable swap)

Add them to `tests/golden-regression.json`. The test runner in
`tests/validateSwap.test.ts` reads that file automatically — no code changes needed.

---

## What NOT to do — common mistakes Cursor should avoid

### Do not invent physics numbers

```json
// ❌ This was v2 — waterActivityDelta is not a real measurement in this context
"waterActivityDelta": 0.3

// ✅ Use physicsConstraints booleans instead
"physicsConstraints": { "moistureSensitive": true, ... }
```

### Do not use a flat cookingArc array

```json
// ❌ v2 — hides parallel preparation tracks
"cookingArc": ["saute", "braise", "dumsteam"]

// ✅ v3 — multi-track
"cookingArcs": [{ "track": "protein", "sequence": [...] }, ...]
```

### Do not use a tuple for textureContrast

```json
// ❌ v2 — loses which component has which texture
"textureContrast": ["granular", "tender"]

// ✅ v3 — component-mapped
"textureContrast": { "primary": { "component": "rice", "texture": "granular" }, ... }
```

### Do not use z.literal() for schemaVersion

```ts
// ❌ Breaks Zod validation on any day you update the schema
schemaVersion: z.literal("2026-04-01")

// ✅ Regex-validated string
schemaVersion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
```

### Do not put logic in the notes field

```json
// ❌ Logic buried in free text — invisible to the engine
"notes": "Do not add eggs because this is vegan"

// ✅ Logic in a guard with bannedDishes + mustNotHave
```

### Do not add a new cuisine zone as a string to neverFromOtherZones

```json
// ❌ v2 — free strings are unmatchable
"neverFromOtherZones": ["cream-cheese sauce logic as default"]

// ✅ v3 — reference guard codes
"neverGuardCodes": ["foreign-cheese-enrichment", "paneer-addition"]
```

---

## Integrity check

`validateDILIntegrity()` runs at server startup and throws on:
- `identityMethod` not present in any `cookingArc` sequence
- `textureContrast` textures not in `textureProfile`
- `hasMarinade: true` with no `pre-cook` acid stage
- Guard `bannedDishes` referencing a dish ID that doesn't exist
- Invalid `schemaVersion` format

If the server won't start, run `validateDILIntegrity()` directly and read the error output.

---

## Current dish coverage (Sprint 0)

- `biryani` — fully furnished, all physics wired

Sprint 1 targets (add in this order — failure-rate ordered, not prestige-ordered):
1. `jerk-chicken`
2. `pho-bo`
3. `pad-thai`
4. `falafel`
5. `ramen`
6. `ceviche`
7. `tacos`
8. `curry` (disambiguation required — will need subtype handling)
ENDOFFILE

cat > src/lib/culinary/systemPrompt.ts << 'ENDOFFILE'
// src/lib/culinary/systemPrompt.ts
// Builds the full system prompt for /api/generate.
// When a dish is recognised in the DIL, injects culinary grammar constraints.
// When unknown, falls back to the base prompt only — never crashes.

import type { DishDNA } from "@/lib/culinary/dil/schemas";
import { buildConstraintPromptFragment } from "@/lib/culinary/dil/promptBuilder";

export type Mode = "proteinify" | "lean" | "veggify";

// ─── Mode instructions ────────────────────────────────────────────────────────

const MODE_INSTRUCTIONS: Record<Mode, string> = {
  proteinify: `
TRANSFORMATION GOAL: Increase protein while preserving dish identity, texture, and cultural grammar.
- Close Match: invisible additions only (whey paste off-heat, cottage cheese blended, portion lift ≤30%). Minimal flavour change.
- Balanced: 2–3 techniques combined. One moderate swap acceptable. Protein target: +25–40g.
- Full Send: all available techniques. Strong protein increase. Flavour change expected. Protein target: +45g+.
`.trim(),

  lean: `
TRANSFORMATION GOAL: Reduce calories and fat while keeping the dish recognisable and satisfying.
- Close Match: reduce fat vehicle quantity only. Same ingredients, smaller fat amounts.
- Balanced: swap one high-fat element; increase lean protein to compensate for satiety.
- Full Send: lean protein swap, reduced fat vehicle, added volume via vegetables. Must preserve structural texture.
`.trim(),

  veggify: `
TRANSFORMATION GOAL: Add vegetables meaningfully without breaking texture and flavour grammar.
- Close Match: one vegetable that fits the dish's cooking method and cultural zone.
- Balanced: 2–3 vegetables. Adjust liquid and seasoning to compensate for added moisture.
- Full Send: maximum vegetables. Structural anchors (rice, noodle, legume base) must remain intact.
`.trim(),
};

// ─── Base system prompt ───────────────────────────────────────────────────────

const BASE = `
You are Proteinify — a culinary transformation engine that upgrades dishes people already love.
You output exactly 3 versions: Close Match, Balanced, and Full Send.
Each version is a coherent recipe modification, not a random list of additions.

## Core rules

1. Never destroy dish identity. The dish must still be recognisable after transformation.
2. Protein numbers must be realistic per serving. Do not invent implausible values.
3. heatGuard is mandatory whenever temperature matters:
   - Whey isolate curdles above 70°C — paste method only, off heat.
   - Dairy splits if boiled after adding — keep below simmer.
   - Eggs scramble above 75°C in sauces.
4. textureNote is mandatory whenever a swap changes texture:
   - Legume pasta releases less starch — sauce needs more liquid.
   - Cottage cheese adds graininess if not blended smooth.
   - Konjac rice must be rinsed and dried before adding to wet dishes.
5. appliedSwapCodes: output ONLY codes from the VALID SWAP CODES list provided below.
   If no constraint block is present, output an empty array [].
6. Never add soft-boiled egg to any dish unless it is ramen, Japanese rice bowl, or a dish
   where egg is explicitly in the identity.
7. Never suggest paneer in non-South-Asian dishes.
8. Never replace rice with cauliflower rice in any dish cooked with dum (sealed steam).
9. Each version's proteinDeltaG must be a realistic estimate — not a round guess.
   Base it on the specific ingredients added and their standard serving sizes.
`.trim();

// ─── Public builder ───────────────────────────────────────────────────────────

/**
 * Returns the full system prompt string for the OpenAI call.
 * If dilDish is provided, appends the constraint block from the DIL.
 */
export function buildSystemPrompt(mode: Mode, dilDish: DishDNA | null): string {
  const parts: string[] = [
    BASE,
    "",
    "## Transformation mode",
    MODE_INSTRUCTIONS[mode],
  ];

  if (dilDish) {
    parts.push("");
    parts.push("## Culinary grammar constraints (from Dish Identity Library)");
    parts.push(buildConstraintPromptFragment(dilDish));
  } else {
    parts.push("");
    parts.push("## Dish not in DIL");
    parts.push(
      "This dish is not yet in the Dish Identity Library. Apply general culinary judgment. " +
      "appliedSwapCodes must be []."
    );
  }

  return parts.join("\n");
}
ENDOFFILE

cat > src/lib/culinary/dil/schemas.ts << 'ENDOFFILE'
// src/lib/culinary/dil/schemas.ts
// v3 — fixes: multi-track cookingArcs, stage-aware fatVehicle, component-mapped
// textureContrast, typed mustNotHave, physicsConstraints, goal-aware
// alternativesByGoal, quantityThreshold, allowOverride, telemetry types,
// schemaVersion as regex (not brittle literal), richer acidAnchor.

import { z } from "zod";

// ─── Primitives ───────────────────────────────────────────────────────────────

export const CookingMethodId = z.enum([
  "dumsteam", "dryrubgrill", "stirfry", "braise", "deepfry",
  "rawacidcured", "bake", "simmerstew", "brothnoodle", "saute",
  "shallowfry",   // added: birista in biryani, shallow pan-fry contexts
  "parboil",      // added: rice par-cook track in biryani, pasta par-cook
]);
export type CookingMethodId = z.infer<typeof CookingMethodId>;

export const CuisineZoneId = z.enum([
  "southasian", "southeastasian", "caribbean", "middleeastern",
  "latinamerican", "eastasian", "italian", "westafrican", "genericamerican",
]);
export type CuisineZoneId = z.infer<typeof CuisineZoneId>;

export const ViolationType = z.enum([
  "methodviolation",
  "zoneviolation",
  "dietaryviolation",
  "structuralviolation",
  "flavorarchviolation",
  "confusionviolation",
  "portabilityviolation",
  "physicsviolation",   // new: fires from ingredientPhysics rules, not just guard lists
]);
export type ViolationType = z.infer<typeof ViolationType>;

export const TextureClass = z.enum([
  "silky", "granular", "fibrous", "crisp", "emulsified", "creamy", "tender",
]);
export type TextureClass = z.infer<typeof TextureClass>;

export const UserGoal = z.enum([
  "protein-boost",
  "vegan",
  "lower-calorie",
  "lower-fat",
  "cultural-coherence",
  "general",
]);
export type UserGoal = z.infer<typeof UserGoal>;

// ─── DishDNA sub-schemas ──────────────────────────────────────────────────────

// FIX (Kenji): fatVehicle is now an array of stage-aware entries.
// Ghee in biryani plays 3 different roles at 3 different temperatures;
// a single {name, thermalPoint} entry collapsed them into one fact.
export const FatVehicleEntry = z.object({
  name: z.string(),
  thermalPoint: z.enum(["high", "low", "neutral"]),
  stage: z.string(),                // e.g. "birista-fry", "spice-bloom", "dum-drizzle"
  role: z.enum([
    "frying-medium",    // load-bearing: smoke point matters
    "flavor-carrier",   // milk solids / compound flavors released into base
    "aromatic-finish",  // added late, volatilizes into sealed steam
    "emulsifier",       // sauces, moles, vinaigrettes
  ]),
});

// FIX (Kenji): acidAnchor now captures concentration and protein interaction.
// pH alone doesn't describe tenderization; contact time and concentration
// determine how much actomyosin denaturation actually occurs.
export const AcidStage = z.object({
  ingredient: z.string(),
  stage: z.enum(["pre-cook", "during-cook", "post-cook", "at-table"]),
  role: z.enum(["tenderizer", "brightness", "balance", "preservation"]),
  pHApprox: z.number().min(0).max(14),
  concentrationPct: z.number().min(0).max(100).optional(),   // % of marinade by weight
  contactTimeMinutes: z.number().optional(),
  proteinEffect: z.enum(["denatures", "brightens", "none"]).optional(),
});

// FIX (Kenji): textureContrast maps each texture class to the specific component
// that carries it. A tuple ["granular", "tender"] can't tell you whether
// the rice is granular or the protein is — so a swap that inverts them passes.
export const TextureContrastEntry = z.object({
  primary: z.object({
    component: z.string(),  // e.g. "rice", "noodle", "legume-patty"
    texture: TextureClass,
  }),
  secondary: z.object({
    component: z.string(),  // e.g. "protein", "sauce", "exterior"
    texture: TextureClass,
  }),
});

// FIX (Kenji + Sundar): multi-track cooking arc.
// Biryani has two parallel preparation tracks that merge at layering.
// A single flat array ["saute", "braise", "dumsteam"] hides the rice
// parboil track and misclassifies birista (shallowfry ≠ saute).
export const CookingArcTrack = z.object({
  track: z.string(),                          // "aromatics-protein", "rice", "assembly"
  sequence: z.array(CookingMethodId),
  mergeAt: z.string().optional(),             // label for the convergence point
  notes: z.string().optional(),
});

// FIX (Sundar): explicit physics flags on the dish.
// Previously waterActivityDelta was a pseudoscientific number with no
// defined semantics. These boolean flags are checkable in the validator.
export const PhysicsConstraints = z.object({
  moistureSensitive: z.boolean(),       // true for dumsteam dishes
  heatTransferCritical: z.boolean(),    // true when thermal mass of proteins matters
  acidTimingSensitive: z.boolean(),     // true when pre-cook vs at-table acid ≠ same
});

export const HistoricallyAbsentItem = z.object({
  item: z.string(),
  confidence: z.enum(["definitive", "contested", "regional"]),
  note: z.string().optional(),
});

// ─── DishDNA ──────────────────────────────────────────────────────────────────

export const DishDNA = z.object({
  id: z.string(),
  displayName: z.string(),
  cuisineZone: CuisineZoneId,

  // FIX (Kenji): replaced single cookingArc with multi-track cookingArcs
  cookingArcs: z.array(CookingArcTrack),
  identityMethod: CookingMethodId,         // the method that "names" the dish

  identityProtein: z.string().nullable(),

  // FIX (Kenji): array of stage-aware entries (was single object)
  fatVehicle: z.array(FatVehicleEntry),

  // FIX (Kenji): richer acid model with concentration + protein effect
  acidAnchor: z.array(AcidStage),

  aromaticBase: z.array(z.string()),
  textureProfile: z.array(TextureClass),

  // FIX (Kenji): component-mapped (was tuple, lost which part is which)
  textureContrast: TextureContrastEntry,

  // FIX (Sundar): explicit physics flags (replaced waterActivityDelta pseudo-number)
  physicsConstraints: PhysicsConstraints,

  isTraditionallyVegan: z.boolean(),
  hasMarinade: z.boolean(),
  dairyPresent: z.boolean(),
  transformationClass: z.enum(["same-soul", "adaptation", "reimagining"]),
  keyNonnegotiables: z.array(z.string()),
  structuralAnchors: z.array(z.string()),
  historicallyAbsent: z.array(HistoricallyAbsentItem),
  acceptedAdaptations: z.array(z.string()),
  confusionRisks: z.array(z.string()),
  servingContext: z.string().nullable(),
  typicalServingSizeg: z.number().nullable(),
  typicalProteinPerServingg: z.number().nullable(),
  notes: z.string().optional(),           // pedagogical only — no logic lives here
  dishAliases: z.array(z.string()),

  // FIX (Sundar): regex instead of z.literal("2026-04-01").
  // A literal breaks Zod validation for every existing entry on any update day.
  schemaVersion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type DishDNA = z.infer<typeof DishDNA>;

// ─── CuisineZone ──────────────────────────────────────────────────────────────

export const CuisineZone = z.object({
  id: CuisineZoneId,
  displayName: z.string(),
  identityFats: z.array(z.string()),
  typicalAcids: z.array(z.string()),
  coreMethods: z.array(CookingMethodId),
  allowedProteins: z.array(z.string()),
  dairyForms: z.array(z.string()),
  // FIX: neverFromOtherZones now references guard codes, not free strings.
  // Free strings like "cream-cheese sauce logic as default" are unmatchable.
  neverGuardCodes: z.array(z.string()),   // references SwapGuard.code
  proteinBoostPatterns: z.array(z.string()),
  notablePhysics: z.array(z.string()),
  subZoneNotes: z.record(z.string(), z.string()).optional(),
  schemaVersion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type CuisineZone = z.infer<typeof CuisineZone>;

// ─── SwapGuard ────────────────────────────────────────────────────────────────

// FIX (Sundar): mustNotHave / mustHave typed as enum of DishDNA boolean keys.
// Previously typed as string[] → (dish as any)[k] in the validator — a type hole.
export const DishDNABooleanKey = z.enum([
  "isTraditionallyVegan",
  "hasMarinade",
  "dairyPresent",
]);
export type DishDNABooleanKey = z.infer<typeof DishDNABooleanKey>;

export const SwapGuard = z.object({
  code: z.string(),

  constraints: z.object({
    mustHave: z.array(DishDNABooleanKey).optional(),
    mustNotHave: z.array(DishDNABooleanKey).optional(),
    bannedMethods: z.array(CookingMethodId).optional(),
    bannedZones: z.array(CuisineZoneId).optional(),
    bannedDishes: z.array(z.string()).optional(),
    bannedIfHistoricallyAbsentIncludes: z.array(z.string()).optional(),
    bannedIfZoneNeverIncludes: z.array(z.string()).optional(),
  }),

  // FIX (Kenji + Sundar): physics of the ingredient being introduced.
  // The validator uses this to fire physicsviolations automatically when
  // the dish's physicsConstraints match (e.g. moistureSensitive + criticalWater).
  ingredientPhysics: z.object({
    freeWaterReleaseRisk: z.enum(["critical", "high", "medium", "low"]).optional(),
    textureBehaviorUnderHeat: z.enum(["dissolves", "firms", "holds", "mashes"]).optional(),
  }).nullable().optional(),

  violationIfBroken: ViolationType,
  severity: z.enum(["blocker", "warning", "suggestion"]),

  // FIX (Sam): quantity thresholds — small garnish ≠ dominant protein swap.
  // Without this, the guard is binary: banned for any amount.
  quantityThreshold: z.object({
    blockerAbovePct: z.number(),   // becomes blocker above this % of dish protein/volume
    warningAbovePct: z.number(),   // warning between warningAbovePct and blockerAbovePct
  }).optional(),

  reason: z.string(),
  educationalContext: z.string(),
  safeAlternatives: z.array(z.string()),   // general fallback alternatives

  // FIX (Sam): goal-aware alternatives. "Increase meat" is wrong for vegan goal.
  alternativesByGoal: z.record(UserGoal, z.array(z.string())).optional(),

  // FIX (Sam): informed override path. Users should be able to say
  // "I understand, do it anyway" for warning-level guards.
  allowOverride: z.boolean(),
});
export type SwapGuard = z.infer<typeof SwapGuard>;

// ─── Engine I/O types ─────────────────────────────────────────────────────────

export type ValidationResult = {
  isValid: boolean;
  violations: Array<{
    code: string;
    type: ViolationType;
    severity: "blocker" | "warning" | "suggestion";
    reason: string;
    educationalContext: string;
    safeAlternatives: string[];
    goalAlternatives: string[];
    allowOverride: boolean;
  }>;
  suggestions: string[];    // deduplicated across all non-blocker guards
};

// FIX (Sam): telemetry event — emitted on every validateSwap call.
// Without this, you have no data to drive Sprint 1 dish prioritisation.
export type ValidationEvent = {
  dishId: string;
  proposedCodes: string[];
  violationCodes: string[];
  suggestionsShown: string[];
  userGoal: UserGoal | null;
  isValid: boolean;
  timestamp: number;
};

export type ValidateSwapOptions = {
  userGoal?: UserGoal;
  quantity?: "trace" | "minor" | "significant" | "dominant";
  onEvent?: (event: ValidationEvent) => void;
};

export type SwapInput = {
  code: string;
  quantity?: "trace" | "minor" | "significant" | "dominant";
};

// Maps quantity label to approximate percentage for threshold comparisons
export const QUANTITY_PCT_MAP: Record<NonNullable<SwapInput["quantity"]>, number> = {
  trace: 3,
  minor: 10,
  significant: 25,
  dominant: 60,
};
ENDOFFILE

cat > src/lib/culinary/dil/loader.ts << 'ENDOFFILE'
// src/lib/culinary/dil/loader.ts
// FIX: indexes derived from data at load time (no hardcoding in promptBuilder);
// alias collision detection; validateDILIntegrity with cross-reference checks.

import { z } from "zod";
import dishDNAData from "./data/dishDNA.json" with { type: "json" };
import swapGuardsData from "./data/swapGuards.json" with { type: "json" };

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
ENDOFFILE

cat > src/lib/culinary/dil/promptBuilder.ts << 'ENDOFFILE'
// src/lib/culinary/dil/promptBuilder.ts
// FIX: guard codes are derived from the loader index — never hardcoded.
// FIX: exports a buildToolDefinition() for Anthropic tool_use API so the
//      LLM is structurally forced to return valid swap codes, not free text.

import type { DishDNA, SwapGuard } from "./schemas";
import { getGuardsForDish } from "./loader";

// ─── Constraint prompt fragment ───────────────────────────────────────────────

/**
 * Builds the constraint block injected into the system prompt.
 * Uses only the fields that are small and meaningful to the LLM;
 * does NOT dump the entire DishDNA (token budget).
 */
export function buildConstraintPromptFragment(dish: DishDNA): string {
  const relevantGuards = getGuardsForDish(dish);   // FIX: derived, not hardcoded
  const blockerCodes = relevantGuards
    .filter(g => g.severity === "blocker")
    .map(g => g.code);
  const warningCodes = relevantGuards
    .filter(g => g.severity === "warning")
    .map(g => g.code);
  const allValidCodes = relevantGuards.map(g => g.code);

  const arcSummary = dish.cookingArcs
    .map(arc => `${arc.track}: ${arc.sequence.join(" → ")}`)
    .join(" | ");

  const absentItems = dish.historicallyAbsent
    .filter(h => h.confidence === "definitive")
    .map(h => h.item)
    .join(", ");

  return `
## CULINARY GRAMMAR CONSTRAINTS — ${dish.displayName.toUpperCase()}
Zone: ${dish.cuisineZone}
Cooking arcs: ${arcSummary}
Identity method: ${dish.identityMethod}
Non-negotiables: ${dish.keyNonnegotiables.slice(0, 3).join("; ")}
Structurally absent (definitive): ${absentItems || "none specified"}

## SWAP CODE CONTRACT
You MUST call the apply_swap_codes tool with a JSON response.
Do NOT describe swaps in free text. Do NOT invent codes.

Valid codes for this dish: ${allValidCodes.length > 0 ? allValidCodes.join(" | ") : "(none — all free-text swaps require code mapping)"}

BLOCKED (blocker): ${blockerCodes.length > 0 ? blockerCodes.join(", ") : "none"}
FLAGGED (warning, user can override): ${warningCodes.length > 0 ? warningCodes.join(", ") : "none"}

If no relevant swap codes apply, return: { "appliedSwaps": [] }
`.trim();
}

// ─── Anthropic tool definition ────────────────────────────────────────────────
// FIX (Sam): previously the prompt only "asked" the model to respond in JSON.
// Using tool_use with tool_choice: {type: "tool"} makes the API return a
// guaranteed structured object — not a text block that might wrap in markdown.

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Returns the Anthropic tool definition for swap code output.
 * Pass as tools: [buildToolDefinition(dish)] plus
 * tool_choice: { type: "tool", name: "apply_swap_codes" }
 * in the API call.
 */
export function buildToolDefinition(dish: DishDNA): AnthropicTool {
  const relevantGuards = getGuardsForDish(dish);
  const validCodes = relevantGuards.map(g => g.code);

  return {
    name: "apply_swap_codes",
    description: `Apply only valid culinary swap codes for ${dish.displayName}. Do not invent codes.`,
    input_schema: {
      type: "object",
      properties: {
        appliedSwaps: {
          type: "array",
          description: "Swap codes to apply. Must be from the validCodes list only.",
          items: {
            type: "object",
            properties: {
              code: {
                type: "string",
                enum: validCodes.length > 0 ? validCodes : ["__no_swaps__"],
                description: "A valid swap code for this dish",
              },
              quantity: {
                type: "string",
                enum: ["trace", "minor", "significant", "dominant"],
                description: "Approximate proportion of the swap in the dish",
              },
            },
            required: ["code"],
          },
        },
        reasoning: {
          type: "string",
          description: "Brief explanation of why these swaps are being applied",
        },
      },
      required: ["appliedSwaps"],
    },
  };
}

// ─── Complete API call payload builder ───────────────────────────────────────

/**
 * Returns the full payload shape for an Anthropic API messages call
 * with constraint injection + forced tool use.
 *
 * Usage:
 *   const payload = buildAPIPayload(dish, userMessage);
 *   const response = await fetch("https://api.anthropic.com/v1/messages", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify(payload),
 *   });
 */
export function buildAPIPayload(dish: DishDNA, userMessage: string) {
  return {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: buildConstraintPromptFragment(dish),
    tools: [buildToolDefinition(dish)],
    tool_choice: { type: "tool", name: "apply_swap_codes" },
    messages: [
      { role: "user", content: userMessage },
    ],
  };
}

/**
 * Extracts the structured swap input from a raw Anthropic API response.
 * Returns null if the tool was not called (should not happen with tool_choice forced).
 */
export function extractSwapsFromResponse(
  responseContent: Array<{ type: string; name?: string; input?: unknown }>
): Array<{ code: string; quantity?: string }> | null {
  const toolUse = responseContent.find(
    block => block.type === "tool_use" && block.name === "apply_swap_codes"
  );
  if (!toolUse || typeof toolUse.input !== "object" || toolUse.input === null) {
    return null;
  }
  const input = toolUse.input as { appliedSwaps?: Array<{ code: string; quantity?: string }> };
  return input.appliedSwaps ?? [];
}
ENDOFFILE

cat > src/lib/culinary/dil/validator.ts << 'ENDOFFILE'
// src/lib/culinary/dil/validator.ts
// FIX: no more (dish as any)[k] — mustNotHave uses typed keyof DishDNA enum.
// FIX: separate physics violation pass wired to ingredientPhysics + physicsConstraints.
// FIX: goal-aware alternative suggestions.
// FIX: emitValidationEvent telemetry hook.
// FIX: quantity-aware severity (trace amount shouldn't trigger a blocker).

import type {
  DishDNA,
  SwapGuard,
  ValidationResult,
  ValidationEvent,
  ValidateSwapOptions,
  UserGoal,
  SwapInput,
} from "./schemas";
import { QUANTITY_PCT_MAP } from "./schemas";
import { allSwapGuards } from "./loader";

// ─── Typed boolean key accessor ───────────────────────────────────────────────
// FIX: replaces (dish as any)[k] — only boolean fields are accessible here,
// enforced by the DishDNABooleanKey enum in schemas.ts.

type BooleanDishKey = "isTraditionallyVegan" | "hasMarinade" | "dairyPresent";

function getBooleanField(dish: DishDNA, key: BooleanDishKey): boolean {
  return dish[key];
}

// ─── Physics violation pass ───────────────────────────────────────────────────
// FIX (Sundar + Kenji): previously "waterActivityDelta > 0.2" was documented
// but never wired. Now physicsConstraints on the dish + ingredientPhysics on
// the guard produce physicsviolations automatically.

function checkPhysicsViolations(
  dish: DishDNA,
  guard: SwapGuard,
  quantity: SwapInput["quantity"],
): "blocker" | "warning" | null {
  if (!guard.ingredientPhysics || !dish.physicsConstraints) return null;

  const { freeWaterReleaseRisk } = guard.ingredientPhysics;
  const { moistureSensitive } = dish.physicsConstraints;

  if (!moistureSensitive || !freeWaterReleaseRisk) return null;

  // "critical" water-release ingredients in moisture-sensitive dishes
  // are always physics blockers regardless of guard list rules.
  if (freeWaterReleaseRisk === "critical") return "blocker";

  // "high" water-release is a warning unless added in significant/dominant amount
  if (freeWaterReleaseRisk === "high") {
    const pct = quantity ? QUANTITY_PCT_MAP[quantity] : 25; // assume significant if unknown
    return pct >= 15 ? "blocker" : "warning";
  }

  return null;
}

// ─── Quantity-aware severity resolution ───────────────────────────────────────
// FIX (Sam): a trace amount of soy chunks as garnish ≠ full protein replacement.
// Severity can be downgraded based on quantityThreshold if quantity is provided.

function resolveEffectiveSeverity(
  guard: SwapGuard,
  quantity: SwapInput["quantity"] | undefined,
): "blocker" | "warning" | "suggestion" {
  if (!guard.quantityThreshold || !quantity) return guard.severity;

  const pct = QUANTITY_PCT_MAP[quantity];
  const { blockerAbovePct, warningAbovePct } = guard.quantityThreshold;

  if (pct >= blockerAbovePct) return "blocker";
  if (pct >= warningAbovePct) return "warning";
  return "suggestion";
}

// ─── Goal-aware alternatives ──────────────────────────────────────────────────

function getGoalAlternatives(guard: SwapGuard, userGoal: UserGoal | undefined): string[] {
  if (!userGoal || !guard.alternativesByGoal) return [];
  return guard.alternativesByGoal[userGoal] ?? guard.alternativesByGoal["general"] ?? [];
}

// ─── Main validator ───────────────────────────────────────────────────────────

/**
 * Validates proposed swap inputs against DIL guards for the given dish.
 *
 * @param dish     The resolved DishDNA context
 * @param swaps    Array of {code, quantity?} from the LLM tool call output
 * @param options  userGoal, quantity override, onEvent telemetry callback
 */
export function validateSwap(
  dish: DishDNA,
  swaps: SwapInput[],
  options: ValidateSwapOptions = {},
): ValidationResult {
  const { userGoal, onEvent } = options;
  const violations: ValidationResult["violations"] = [];
  const allSuggestions = new Set<string>();

  for (const swap of swaps) {
    const guard = allSwapGuards.find(g => g.code === swap.code);
    if (!guard) {
      // Unknown code — not in guard list. Treat as a warning, not a silent pass.
      violations.push({
        code: swap.code,
        type: "portabilityviolation",
        severity: "warning",
        reason: `Swap code "${swap.code}" is not in the DIL guard registry for this dish.`,
        educationalContext: "Unregistered codes may indicate the model generated a code outside the valid set. Review the tool output contract.",
        safeAlternatives: [],
        goalAlternatives: [],
        allowOverride: true,
      });
      continue;
    }

    let violated = false;
    const c = guard.constraints;

    // ── Hard bans by dish, method, zone ──────────────────────────────────────
    if (c.bannedDishes?.includes(dish.id)) violated = true;
    if (!violated && c.bannedMethods?.includes(dish.identityMethod)) violated = true;
    if (!violated && c.bannedZones?.includes(dish.cuisineZone)) violated = true;

    // ── Typed boolean flag checks ─────────────────────────────────────────────
    // FIX: no (dish as any)[k] — uses typed BooleanDishKey accessor
    if (!violated && c.mustNotHave) {
      violated = c.mustNotHave.some(key =>
        getBooleanField(dish, key as BooleanDishKey) === true
      );
    }
    if (!violated && c.mustHave) {
      violated = c.mustHave.some(key =>
        getBooleanField(dish, key as BooleanDishKey) === false
      );
    }

    // ── Historical absence check ──────────────────────────────────────────────
    if (!violated && c.bannedIfHistoricallyAbsentIncludes) {
      violated = c.bannedIfHistoricallyAbsentIncludes.some(bannedItem =>
        dish.historicallyAbsent.some(h => h.item === bannedItem)
      );
    }

    if (!violated) continue;

    // ── Physics override (may escalate severity) ──────────────────────────────
    const physicsSeverity = checkPhysicsViolations(dish, guard, swap.quantity);
    const effectiveSeverity = physicsSeverity
      ? (physicsSeverity === "blocker" ? "blocker" : resolveEffectiveSeverity(guard, swap.quantity))
      : resolveEffectiveSeverity(guard, swap.quantity);

    const goalAlternatives = getGoalAlternatives(guard, userGoal);

    violations.push({
      code: guard.code,
      type: physicsSeverity ? "physicsviolation" : guard.violationIfBroken,
      severity: effectiveSeverity,
      reason: guard.reason,
      educationalContext: guard.educationalContext,
      safeAlternatives: guard.safeAlternatives,
      goalAlternatives,
      allowOverride: guard.allowOverride,
    });

    // Collect suggestions from non-blocker violations
    if (effectiveSeverity !== "blocker") {
      [...guard.safeAlternatives, ...goalAlternatives].forEach(s => allSuggestions.add(s));
    }
  }

  const result: ValidationResult = {
    isValid: violations.every(v => v.severity !== "blocker"),
    violations,
    suggestions: [...allSuggestions],
  };

  // ── Telemetry ─────────────────────────────────────────────────────────────
  // FIX (Sam): emits a ValidationEvent on every call — noop if no handler provided.
  // Wire onEvent to your analytics/logging layer from the call site.
  if (onEvent) {
    const event: ValidationEvent = {
      dishId: dish.id,
      proposedCodes: swaps.map(s => s.code),
      violationCodes: violations.map(v => v.code),
      suggestionsShown: result.suggestions,
      userGoal: userGoal ?? null,
      isValid: result.isValid,
      timestamp: Date.now(),
    };
    onEvent(event);
  }

  return result;
}
ENDOFFILE

cat > src/lib/culinary/dil/index.ts << 'ENDOFFILE'
// src/lib/culinary/dil/index.ts
// Public API surface — import only from here, not from internal modules.

export { getDishByIdOrAlias } from "./loader";
export { validateDILIntegrity } from "./loader";
export { buildConstraintPromptFragment, buildToolDefinition, buildAPIPayload, extractSwapsFromResponse } from "./promptBuilder";
export { validateSwap } from "./validator";
export type {
  DishDNA,
  SwapGuard,
  ValidationResult,
  ValidationEvent,
  ValidateSwapOptions,
  SwapInput,
  UserGoal,
} from "./schemas";

// ─── Integration quick-start ──────────────────────────────────────────────────
//
// import {
//   getDishByIdOrAlias,
//   buildAPIPayload,
//   extractSwapsFromResponse,
//   validateSwap,
//   validateDILIntegrity,
// } from "@/lib/culinary/dil";
//
// // Run at server startup (throws if data is inconsistent)
// validateDILIntegrity();
//
// // On user request:
// const dish = getDishByIdOrAlias(userInput);
// if (!dish) return fallback();
//
// const payload = buildAPIPayload(dish, userMessage);
// const response = await fetch("https://api.anthropic.com/v1/messages", {
//   method: "POST",
//   headers: { "Content-Type": "application/json" },
//   body: JSON.stringify(payload),
// });
// const data = await response.json();
// const swaps = extractSwapsFromResponse(data.content) ?? [];
//
// const result = validateSwap(dish, swaps, {
//   userGoal: "protein-boost",    // from user profile or detected intent
//   onEvent: (event) => analytics.track("dil_validation", event),
// });
//
// if (!result.isValid) {
//   // Surface violations with educationalContext + goalAlternatives to user
//   // result.violations[0].allowOverride controls whether to offer "do it anyway"
// }
// // Otherwise: proceed to recipe expansion with validated swap context
ENDOFFILE

cat > src/lib/culinary/dil/data/dishDNA.json << 'ENDOFFILE'
[
  {
    "id": "biryani",
    "displayName": "Biryani",
    "cuisineZone": "southasian",

    "cookingArcs": [
      {
        "track": "aromatics-and-protein",
        "sequence": ["saute", "shallowfry", "braise"],
        "mergeAt": "layering",
        "notes": "saute = spice bloom in ghee; shallowfry = birista at 150-165C; braise = meat curry base"
      },
      {
        "track": "rice",
        "sequence": ["parboil"],
        "mergeAt": "layering",
        "notes": "Rice parboiled to ~70% doneness in salted water before layering. Separate track — often runs concurrently with protein track."
      },
      {
        "track": "assembly",
        "sequence": ["dumsteam"],
        "notes": "Sealed-vessel steam finish; dum seal (dough or foil) is load-bearing"
      }
    ],

    "identityMethod": "dumsteam",
    "identityProtein": "lamb or chicken",

    "fatVehicle": [
      {
        "name": "ghee",
        "thermalPoint": "high",
        "stage": "spice-bloom",
        "role": "flavor-carrier"
      },
      {
        "name": "ghee",
        "thermalPoint": "high",
        "stage": "birista-fry",
        "role": "frying-medium"
      },
      {
        "name": "ghee",
        "thermalPoint": "neutral",
        "stage": "dum-drizzle",
        "role": "aromatic-finish"
      }
    ],

    "acidAnchor": [
      {
        "ingredient": "yogurt",
        "stage": "pre-cook",
        "role": "tenderizer",
        "pHApprox": 4.5,
        "concentrationPct": 30,
        "contactTimeMinutes": 120,
        "proteinEffect": "denatures"
      }
    ],

    "aromaticBase": [
      "birista (fried onions — Maillard at 150-165C)",
      "whole garam masala: cardamom, clove, cinnamon (bloomed in ghee first)",
      "saffron / kewra water (added at dum layer)"
    ],

    "textureProfile": ["granular", "tender"],

    "textureContrast": {
      "primary": { "component": "rice", "texture": "granular" },
      "secondary": { "component": "protein", "texture": "tender" }
    },

    "physicsConstraints": {
      "moistureSensitive": true,
      "heatTransferCritical": true,
      "acidTimingSensitive": true
    },

    "isTraditionallyVegan": false,
    "hasMarinade": true,
    "dairyPresent": true,
    "transformationClass": "same-soul",

    "keyNonnegotiables": [
      "layered rice and protein structure — layers must remain distinct",
      "aromatic whole spices bloomed in fat before any liquid",
      "birista (slow-fried browned onions) — not caramelised, not raw",
      "dum-style sealed-steam finish",
      "identity protein remains in recognisable pieces"
    ],

    "structuralAnchors": [
      "long-grain rice (basmati preferred — low starch leach)",
      "dum seal (dough rope or foil — traps steam pressure)"
    ],

    "historicallyAbsent": [
      {
        "item": "soft-boiled jammy egg alongside",
        "confidence": "definitive",
        "note": "Anda (egg) biryani exists as its own dish. Adding a soft-boiled egg to meat biryani imports ramen logic."
      },
      {
        "item": "textured soy chunks as core protein replacement",
        "confidence": "definitive"
      },
      {
        "item": "full cauliflower rice replacement",
        "confidence": "definitive",
        "note": "Cauliflower releases ~92% free water under dum pressure — destroys grain separation."
      },
      {
        "item": "cream sauce or dairy-heavy enrichment post-cook",
        "confidence": "regional",
        "note": "Mughlai variants may use cream, but it enters before dum, not as a finish."
      }
    ],

    "acceptedAdaptations": [
      "increase original meat portion modestly (up to +30%)",
      "add bone broth only as rice cooking liquid (not poured in post-layer)",
      "konjac rice blend up to 30% — must be thoroughly drained before layering",
      "paneer in paneer-forward variant — treat as separate dish logic, not swap"
    ],

    "confusionRisks": [
      "pulao (cooked in one pot — no dum, no layering)",
      "generic curry rice (sauce absorbed into rice — no identity separation)",
      "tandoori logic (dry-rub grill — imports wrong fat, acid, and method grammar)"
    ],

    "servingContext": "Layered rice dish served as a complete centrepiece — lifted from pot with both layers visible",
    "typicalServingSizeg": 400,
    "typicalProteinPerServingg": 26,

    "notes": "The dum (sealed steam pressure) is the defining physics. Any swap introducing excess free water collapses grain separation. Birista is not optional — it provides the Maillard-sweet backbone the whole dish is built on. The marinade acid timing is load-bearing: yogurt at 30% concentration for 2+ hours denatures actomyosin; rushing this or replacing it with post-cook acid produces a different texture.",

    "dishAliases": [
      "chicken biryani",
      "lamb biryani",
      "veg biryani",
      "vegetable biryani",
      "biryani rice",
      "biriani",
      "briyani",
      "biryani with chicken",
      "dum biryani",
      "hyderabadi biryani",
      "lucknowi biryani"
    ],

    "schemaVersion": "2026-04-01"
  }
]
ENDOFFILE

cat > src/lib/culinary/dil/data/swapGuards.json << 'ENDOFFILE'
[
  {
    "code": "cauliflower-rice-swap",
    "constraints": {
      "bannedDishes": ["biryani"]
    },
    "ingredientPhysics": {
      "freeWaterReleaseRisk": "critical",
      "textureBehaviorUnderHeat": "mashes"
    },
    "violationIfBroken": "physicsviolation",
    "severity": "blocker",
    "quantityThreshold": {
      "blockerAbovePct": 5,
      "warningAbovePct": 0
    },
    "reason": "Cauliflower releases free water under dum pressure, collapsing grain separation",
    "educationalContext": "Dum cooking traps steam in a sealed vessel. Cauliflower at ~92% water content raises internal humidity past the starch gelatinisation threshold for long-grain rice. The result is wet, collapsed, indistinct grain — the structural opposite of biryani's granular/tender contrast.",
    "safeAlternatives": [
      "konjac rice blend up to 30% — must be thoroughly drained before layering",
      "reduce portion size; increase aromatic density instead"
    ],
    "alternativesByGoal": {
      "lower-calorie": [
        "konjac rice blend up to 30% — drain thoroughly",
        "reduce serving size; serve with high-volume low-calorie raita"
      ],
      "lower-fat": [
        "reduce ghee in dum-drizzle stage (not frying stage)",
        "use leaner protein cut (chicken breast instead of thigh)"
      ],
      "protein-boost": [
        "increase meat portion by up to 30%",
        "serve with protein-rich dal side"
      ],
      "vegan": [
        "cauliflower as a side dish preserves its identity — don't sub it into rice",
        "mushroom or paneer biryani is a separate valid dish — treat as new dish logic"
      ],
      "cultural-coherence": [
        "serve cauliflower as a separate subzi side",
        "use a smaller rice portion and larger protein portion"
      ],
      "general": [
        "konjac rice blend up to 30%",
        "reduce rice portion; serve with dal"
      ]
    },
    "allowOverride": false
  },

  {
    "code": "soya-chunks-addition",
    "constraints": {
      "bannedDishes": ["biryani"],
      "bannedMethods": ["dumsteam"]
    },
    "ingredientPhysics": {
      "freeWaterReleaseRisk": "high",
      "textureBehaviorUnderHeat": "firms"
    },
    "violationIfBroken": "structuralviolation",
    "severity": "blocker",
    "quantityThreshold": {
      "blockerAbovePct": 15,
      "warningAbovePct": 5
    },
    "reason": "TVP / soy chunks destroy the layered rice texture and dum steam physics",
    "educationalContext": "Biryani identity depends on protein pieces that hold their form under dum steam — lamb chunks, chicken pieces. Soy chunks absorb water aggressively, swell, and release it into the sealed vessel, raising steam humidity and collapsing grain separation. Their spongy texture also creates a visual identity mismatch when layers are lifted.",
    "safeAlternatives": [
      "increase original meat portion by 20–30%",
      "add chana dal as a coherent legume side (not in the dum vessel)"
    ],
    "alternativesByGoal": {
      "protein-boost": [
        "increase lamb or chicken portion by 25–30%",
        "marinate extra protein in the same yogurt base for consistency"
      ],
      "vegan": [
        "mushroom biryani follows similar dum DNA — treat as a separate dish",
        "jackfruit biryani is an accepted adaptation — lower moisture than soy chunks"
      ],
      "lower-calorie": [
        "reduce meat portion; increase vegetable side dishes",
        "use leaner protein (chicken breast)"
      ],
      "lower-fat": [
        "reduce ghee quantity; use in spice-bloom stage only",
        "switch to leaner protein cut"
      ],
      "cultural-coherence": [
        "use keema (minced meat) as a recognised variation",
        "use paneer only in a distinct paneer biryani — not as a swap"
      ],
      "general": [
        "increase original meat portion",
        "add chana dal as a side"
      ]
    },
    "allowOverride": false
  },

  {
    "code": "soft-boiled-egg-alongside",
    "constraints": {
      "bannedDishes": ["biryani", "jerk-chicken", "pad-thai", "pho-bo"]
    },
    "ingredientPhysics": null,
    "violationIfBroken": "dietaryviolation",
    "severity": "warning",
    "reason": "Soft-boiled egg is not part of classic meat biryani identity — it imports ramen logic",
    "educationalContext": "Anda (egg) biryani exists as its own distinct preparation. A soft-boiled jammy egg placed on top of meat biryani is a presentation borrowed from Japanese ramen culture. It is not a coherent addition in South Asian culinary grammar — eggs belong in the braise layer of egg-forward biryani variants, not as a garnish.",
    "safeAlternatives": [
      "make anda biryani as a separate dish if eggs are desired",
      "add hard-boiled egg to the braise layer only in egg-forward variants"
    ],
    "alternativesByGoal": {
      "protein-boost": [
        "increase meat portion by 25%",
        "serve with a protein-rich dal makhani or chana masala side"
      ],
      "vegan": [
        "egg conflicts with vegan goal — use mushroom or vegetable biryani variant"
      ],
      "lower-calorie": [
        "reduce ghee; serve with low-fat raita"
      ],
      "lower-fat": [
        "reduce ghee quantity in dum-drizzle stage"
      ],
      "cultural-coherence": [
        "anda biryani is the culturally coherent egg variant — make that instead"
      ],
      "general": [
        "increase meat portion",
        "serve with raita"
      ]
    },
    "allowOverride": true
  },

  {
    "code": "paneer-addition",
    "constraints": {
      "bannedZones": ["caribbean", "southeastasian", "middleeastern", "latinamerican"],
      "bannedDishes": ["pho-bo", "jerk-chicken", "falafel", "pad-thai"]
    },
    "ingredientPhysics": {
      "freeWaterReleaseRisk": "low",
      "textureBehaviorUnderHeat": "holds"
    },
    "violationIfBroken": "zoneviolation",
    "severity": "blocker",
    "reason": "Paneer is not a universal protein upgrade and leaks South Asian grammar into other zone dishes",
    "educationalContext": "Paneer is a fresh acid-set dairy cheese that is uniquely South Asian in culinary grammar. It holds form under heat without melting — a property that is meaningful in South Asian cooking but completely foreign to Caribbean smoke-grill logic, Southeast Asian stir-fry balance, or Middle Eastern legume dishes.",
    "safeAlternatives": [
      "use the zone's native protein forms instead",
      "use tofu in Southeast Asian dishes as a structurally similar swap"
    ],
    "alternativesByGoal": {
      "protein-boost": [
        "increase native protein (chicken, fish, chickpeas) by 25%"
      ],
      "vegan": [
        "use tofu in Southeast Asian zone",
        "use extra chickpeas or fava beans in Middle Eastern zone"
      ],
      "lower-calorie": [
        "increase legume content within zone grammar"
      ],
      "lower-fat": [
        "use leaner native protein cuts"
      ],
      "cultural-coherence": [
        "stay within zone's allowedProteins list"
      ],
      "general": [
        "use zone-native protein forms"
      ]
    },
    "allowOverride": false
  },

  {
    "code": "yogurt-marinade-amplification",
    "constraints": {
      "mustNotHave": ["hasMarinade"],
      "bannedDishes": ["jerk-chicken", "falafel", "pho-bo", "pad-thai"]
    },
    "ingredientPhysics": null,
    "violationIfBroken": "confusionviolation",
    "severity": "blocker",
    "reason": "Yogurt marinade only makes sense when the dish already has a marinade structure",
    "educationalContext": "Yogurt marinades tenderise proteins via acid denaturation. This is load-bearing in biryani and some tandoori preparations, where the marinade is part of the cooking arc. Applying yogurt marinade logic to jerk chicken (a dry-rub dish) overwrites its identity with tandoori grammar — a different cultural and physical process.",
    "safeAlternatives": [
      "amplify the dish's existing flavour logic instead",
      "serve a yogurt-based condiment alongside (raita) if dairy brightness is wanted"
    ],
    "alternativesByGoal": {
      "protein-boost": ["increase native protein portion"],
      "lower-fat": ["reduce fat-vehicle quantity in the dish's own cooking arc"],
      "cultural-coherence": ["use the dish's native acid anchor (lime for jerk, tamarind for pad thai)"],
      "general": ["amplify the dish's own flavour elements"],
      "vegan": ["use native vegan acid alternatives"],
      "lower-calorie": ["reduce fat-vehicle quantity"]
    },
    "allowOverride": false
  },

  {
    "code": "bone-broth-substitute",
    "constraints": {
      "bannedMethods": ["dryrubgrill", "rawacidcured", "stirfry", "deepfry"],
      "bannedDishes": ["jerk-chicken", "falafel", "pad-thai"]
    },
    "ingredientPhysics": {
      "freeWaterReleaseRisk": "medium",
      "textureBehaviorUnderHeat": "dissolves"
    },
    "violationIfBroken": "portabilityviolation",
    "severity": "warning",
    "reason": "Bone broth is a braised/simmered context ingredient and does not port to grill or fry methods",
    "educationalContext": "Bone broth adds gelatin and depth in slow-cooked wet contexts. In a dry-heat method (jerk grill) or dry-texture dish (falafel), it introduces free liquid that fundamentally changes the cooking method and result.",
    "safeAlternatives": [
      "use the dish's native umami sources instead",
      "save bone broth for the braised or simmered component of the dish where one exists"
    ],
    "alternativesByGoal": {
      "protein-boost": ["increase native protein portion"],
      "lower-calorie": ["use aromatic herb additions instead of fat-based enrichments"],
      "lower-fat": ["use aromatics for depth without added fat"],
      "cultural-coherence": ["use umami sources native to the dish's zone"],
      "vegan": ["use vegetable stock only in braised contexts"],
      "general": ["use the dish's native liquid if wet addition is needed"]
    },
    "allowOverride": true
  }
]
ENDOFFILE

cat > src/lib/culinary/dil/data/proteinify_schema.json << 'ENDOFFILE'
{
  "name": "proteinify_compact_result",
  "strict": true,
  "schema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["dish", "tagline", "dilDishId", "versions"],
    "properties": {
      "dish": {
        "type": "string",
        "description": "Canonical dish name (e.g. 'Biryani', 'Mac and Cheese')"
      },
      "tagline": {
        "type": "string",
        "description": "One sentence describing the overall transformation strategy"
      },
      "dilDishId": {
        "type": ["string", "null"],
        "description": "DIL dish ID if recognised, null if unknown"
      },
      "versions": {
        "type": "array",
        "minItems": 3,
        "maxItems": 3,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "name",
            "summary",
            "proteinDeltaG",
            "originalProteinG",
            "appliedSwapCodes",
            "ingredients",
            "instructions"
          ],
          "properties": {
            "name": {
              "type": "string",
              "enum": ["Close Match", "Balanced", "Full Send"]
            },
            "summary": {
              "type": "string",
              "description": "One sentence describing the trade-off in this version"
            },
            "proteinDeltaG": {
              "type": "number",
              "description": "Realistic protein added per serving in grams"
            },
            "originalProteinG": {
              "type": "number",
              "description": "Estimated protein in grams in the original dish per serving"
            },
            "appliedSwapCodes": {
              "type": "array",
              "description": "DIL swap codes used in this version. Only codes from the valid list in the system prompt. Empty array [] if dish is unknown or no codes apply.",
              "items": { "type": "string" }
            },
            "ingredients": {
              "type": "array",
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": ["name", "amount", "note"],
                "properties": {
                  "name": { "type": "string" },
                  "amount": { "type": "string" },
                  "note": {
                    "type": "string",
                    "description": "Why this ingredient was added or changed"
                  }
                }
              }
            },
            "instructions": {
              "type": "array",
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": ["step", "heatGuard", "textureNote"],
                "properties": {
                  "step": { "type": "string" },
                  "heatGuard": {
                    "type": ["string", "null"],
                    "description": "Temperature warning if relevant, null if not"
                  },
                  "textureNote": {
                    "type": ["string", "null"],
                    "description": "Texture implication if relevant, null if not"
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
ENDOFFILE

cat > src/lib/culinary/dil/tests/golden-regression.json << 'ENDOFFILE'
[
  {
    "description": "Classic biryani failure: both cauli rice swap and soy protein replacement",
    "dishId": "biryani",
    "swaps": [
      { "code": "cauliflower-rice-swap", "quantity": "dominant" },
      { "code": "soya-chunks-addition", "quantity": "dominant" }
    ],
    "options": { "userGoal": "lower-calorie" },
    "expected": {
      "isValid": false,
      "violationCount": 2,
      "blockedCodes": ["cauliflower-rice-swap", "soya-chunks-addition"],
      "shouldSuggest": ["konjac rice blend up to 30%", "increase original meat portion by 20–30%"]
    }
  },
  {
    "description": "Biryani: cauliflower rice at trace quantity should still be a blocker (physicsviolation overrides quantity)",
    "dishId": "biryani",
    "swaps": [
      { "code": "cauliflower-rice-swap", "quantity": "trace" }
    ],
    "options": {},
    "expected": {
      "isValid": false,
      "violationCount": 1,
      "blockedCodes": ["cauliflower-rice-swap"],
      "violationType": "physicsviolation"
    }
  },
  {
    "description": "Biryani: soy chunks at trace quantity should be a warning not a blocker",
    "dishId": "biryani",
    "swaps": [
      { "code": "soya-chunks-addition", "quantity": "trace" }
    ],
    "options": {},
    "expected": {
      "isValid": true,
      "violationCount": 1,
      "blockedCodes": [],
      "warnedCodes": ["soya-chunks-addition"]
    }
  },
  {
    "description": "Biryani: soft-boiled egg alongside — warning level, override allowed",
    "dishId": "biryani",
    "swaps": [
      { "code": "soft-boiled-egg-alongside" }
    ],
    "options": { "userGoal": "protein-boost" },
    "expected": {
      "isValid": true,
      "violationCount": 1,
      "severity": "warning",
      "allowOverride": true,
      "shouldSuggestGoalAlternative": true
    }
  },
  {
    "description": "Biryani: valid protein-boost swap — no violations",
    "dishId": "biryani",
    "swaps": [],
    "options": { "userGoal": "protein-boost" },
    "expected": {
      "isValid": true,
      "violationCount": 0,
      "blockedCodes": []
    }
  },
  {
    "description": "Jerk chicken: yogurt marinade amplification — confusionviolation (imports tandoori logic)",
    "dishId": "jerk-chicken",
    "swaps": [
      { "code": "yogurt-marinade-amplification" }
    ],
    "options": {},
    "expected": {
      "isValid": false,
      "violationCount": 1,
      "blockedCodes": ["yogurt-marinade-amplification"],
      "violationType": "confusionviolation"
    }
  },
  {
    "description": "Jerk chicken: paneer addition — zoneviolation (paneer is not Caribbean grammar)",
    "dishId": "jerk-chicken",
    "swaps": [
      { "code": "paneer-addition" }
    ],
    "options": {},
    "expected": {
      "isValid": false,
      "violationCount": 1,
      "blockedCodes": ["paneer-addition"],
      "violationType": "zoneviolation"
    }
  },
  {
    "description": "Jerk chicken: bone broth addition — portabilityviolation (broth in grill method)",
    "dishId": "jerk-chicken",
    "swaps": [
      { "code": "bone-broth-substitute" }
    ],
    "options": {},
    "expected": {
      "isValid": true,
      "violationCount": 1,
      "severity": "warning",
      "warnedCodes": ["bone-broth-substitute"],
      "allowOverride": true
    }
  },
  {
    "description": "Biryani: unregistered code from model hallucination — should warn, not silently pass",
    "dishId": "biryani",
    "swaps": [
      { "code": "add-mozzarella-topping" }
    ],
    "options": {},
    "expected": {
      "isValid": true,
      "violationCount": 1,
      "severity": "warning",
      "reason": "unregistered code"
    }
  },
  {
    "description": "Biryani: multiple valid swaps with vegan goal — goal alternatives should be vegan-specific",
    "dishId": "biryani",
    "swaps": [
      { "code": "soya-chunks-addition", "quantity": "dominant" },
      { "code": "soft-boiled-egg-alongside" }
    ],
    "options": { "userGoal": "vegan" },
    "expected": {
      "isValid": false,
      "violationCount": 2,
      "blockedCodes": ["soya-chunks-addition"],
      "warnedCodes": ["soft-boiled-egg-alongside"],
      "goalAlternativesShouldMentionVegan": true
    }
  }
]
ENDOFFILE

cat > src/lib/culinary/dil/tests/validateSwap.test.ts << 'ENDOFFILE'
// src/lib/culinary/dil/tests/validateSwap.test.ts
// Run with: npx vitest run  OR  npx jest
// Covers all 10 golden regression cases.

import { describe, it, expect, beforeAll } from "vitest";
import { getDishByIdOrAlias, validateDILIntegrity } from "../loader";
import { validateSwap } from "../validator";
import goldenCases from "./golden-regression.json";
import type { SwapInput, UserGoal } from "../schemas";

beforeAll(() => {
  // Throws if any data inconsistency is found — catches regressions immediately
  validateDILIntegrity();
});

describe("DIL golden regression suite", () => {
  for (const tc of goldenCases) {
    it(tc.description, () => {
      const dish = getDishByIdOrAlias(tc.dishId);
      expect(dish).not.toBeNull();
      if (!dish) return;

      const events: unknown[] = [];
      const result = validateSwap(
        dish,
        tc.swaps as SwapInput[],
        {
          userGoal: tc.options?.userGoal as UserGoal | undefined,
          onEvent: (e) => events.push(e),
        }
      );

      // Always check isValid
      expect(result.isValid).toBe(tc.expected.isValid);

      // Violation count
      expect(result.violations.length).toBe(tc.expected.violationCount);

      // Blocked codes
      if (tc.expected.blockedCodes) {
        const blockers = result.violations
          .filter(v => v.severity === "blocker")
          .map(v => v.code);
        for (const code of tc.expected.blockedCodes) {
          expect(blockers).toContain(code);
        }
      }

      // Warned codes
      if (tc.expected.warnedCodes) {
        const warnings = result.violations
          .filter(v => v.severity === "warning")
          .map(v => v.code);
        for (const code of tc.expected.warnedCodes) {
          expect(warnings).toContain(code);
        }
      }

      // ViolationType
      if (tc.expected.violationType) {
        const types = result.violations.map(v => v.type);
        expect(types).toContain(tc.expected.violationType);
      }

      // Override flag
      if (tc.expected.allowOverride !== undefined) {
        const relevantViolation = result.violations[0];
        expect(relevantViolation?.allowOverride).toBe(tc.expected.allowOverride);
      }

      // Suggestions
      if (tc.expected.shouldSuggest) {
        for (const s of tc.expected.shouldSuggest) {
          const allAlts = result.violations.flatMap(v => [
            ...v.safeAlternatives,
            ...v.goalAlternatives,
          ]);
          expect(allAlts.some(a => a.toLowerCase().includes(s.toLowerCase()))).toBe(true);
        }
      }

      // Vegan goal alternatives check
      if (tc.expected.goalAlternativesShouldMentionVegan) {
        const goalAlts = result.violations.flatMap(v => v.goalAlternatives);
        expect(goalAlts.some(a => a.toLowerCase().includes("vegan") || a.toLowerCase().includes("mushroom"))).toBe(true);
      }

      // Telemetry event fired
      expect(events.length).toBe(1);
      const event = events[0] as { dishId: string; isValid: boolean };
      expect(event.dishId).toBe(tc.dishId);
      expect(event.isValid).toBe(tc.expected.isValid);
    });
  }
});
ENDOFFILE

cat > src/app/api/generate/route.ts << 'ENDOFFILE'
// src/app/api/generate/route.ts
// Proteinify generation route — DIL wired in.
//
// Flow:
//   1. Parse request (dish, mode, userGoal, sliders)
//   2. DIL lookup — resolve dish, get constraints
//   3. Build system prompt with constraints injected
//   4. OpenAI call — JSON schema structured output, same model as before
//   5. Parse + validate each version's appliedSwapCodes against DIL guards
//   6. Return result with dilValidation attached per version

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { getDishByIdOrAlias, validateDILIntegrity } from "@/lib/culinary/dil/loader";
import { validateSwap } from "@/lib/culinary/dil/validator";
import { buildSystemPrompt, type Mode } from "@/lib/culinary/systemPrompt";
import type { SwapInput, UserGoal, ValidationResult } from "@/lib/culinary/dil/schemas";

import proteinifySchema from "@/lib/culinary/dil/data/proteinify_schema.json";

// ─── Run integrity check once at cold start ───────────────────────────────────
// Throws loudly if dishDNA.json or swapGuards.json have inconsistencies.
// In production this fires on the first request after deploy.
let integrityChecked = false;
function ensureIntegrity() {
  if (!integrityChecked) {
    validateDILIntegrity();
    integrityChecked = true;
  }
}

// ─── OpenAI client ────────────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Request shape ────────────────────────────────────────────────────────────
interface GenerateRequest {
  dish: string;
  mode: Mode;
  userGoal?: UserGoal;
  sliders?: {
    flavorPreservation?: number;   // 0–100
    proteinAggression?: number;    // 0–100
    ingredientRealism?: number;    // 0–100
  };
}

// ─── Response shape ───────────────────────────────────────────────────────────
// Same structure as before + dilValidation per version (null if dish unknown)
export interface GenerateResponse {
  dish: string;
  tagline: string;
  dilDishId: string | null;
  dilRecognised: boolean;
  versions: Array<{
    name: "Close Match" | "Balanced" | "Full Send";
    summary: string;
    proteinDeltaG: number;
    originalProteinG: number;
    appliedSwapCodes: string[];
    ingredients: Array<{ name: string; amount: string; note: string }>;
    instructions: Array<{
      step: string;
      heatGuard: string | null;
      textureNote: string | null;
    }>;
    // Added by DIL post-validation
    dilValidation: ValidationResult | null;
  }>;
}

// ─── User message builder ─────────────────────────────────────────────────────
function buildUserMessage(
  dishInput: string,
  mode: Mode,
  sliders?: GenerateRequest["sliders"]
): string {
  const lines = [`Transform: ${dishInput}`, `Mode: ${mode}`];

  if (sliders) {
    if (sliders.flavorPreservation !== undefined) {
      lines.push(`Flavor preservation: ${sliders.flavorPreservation}/100 (higher = stay closer to original taste)`);
    }
    if (sliders.proteinAggression !== undefined) {
      lines.push(`Protein aggression: ${sliders.proteinAggression}/100 (higher = push protein harder)`);
    }
    if (sliders.ingredientRealism !== undefined) {
      lines.push(`Ingredient realism: ${sliders.ingredientRealism}/100 (higher = common grocery store items only)`);
    }
  }

  lines.push("");
  lines.push("Generate 3 versions: Close Match, Balanced, Full Send.");
  lines.push("Each version must be coherent and cook-ready.");

  return lines.join("\n");
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    ensureIntegrity();

    const body: GenerateRequest = await req.json();
    const { dish: dishInput, mode, userGoal, sliders } = body;

    if (!dishInput || !mode) {
      return NextResponse.json(
        { error: "dish and mode are required" },
        { status: 400 }
      );
    }

    // ── Step 1: DIL lookup ──────────────────────────────────────────────────
    const dilDish = getDishByIdOrAlias(dishInput);

    console.log(
      `[generate] dish="${dishInput}" | dil=${dilDish?.id ?? "unknown"} | mode=${mode} | goal=${userGoal ?? "none"}`
    );

    // ── Step 2: Build system prompt with or without DIL constraints ─────────
    const systemPrompt = buildSystemPrompt(mode, dilDish);

    // ── Step 3: OpenAI call — same model, same schema, constraints injected ─
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: {
        type: "json_schema",
        json_schema: proteinifySchema as Parameters<
          typeof openai.chat.completions.create
        >[0]["response_format"] extends { json_schema: infer S } ? { json_schema: S } : never,
      },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildUserMessage(dishInput, mode, sliders) },
      ],
      temperature: 0.4,  // lower temp = more consistent recipe logic
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "OpenAI returned an empty response" },
        { status: 502 }
      );
    }

    // ── Step 4: Parse JSON output ───────────────────────────────────────────
    let parsed: {
      dish: string;
      tagline: string;
      dilDishId: string | null;
      versions: Array<{
        name: string;
        summary: string;
        proteinDeltaG: number;
        originalProteinG: number;
        appliedSwapCodes: string[];
        ingredients: Array<{ name: string; amount: string; note: string }>;
        instructions: Array<{
          step: string;
          heatGuard: string | null;
          textureNote: string | null;
        }>;
      }>;
    };

    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("[generate] JSON parse failed:", raw.slice(0, 200));
      return NextResponse.json(
        { error: "Failed to parse model output as JSON" },
        { status: 502 }
      );
    }

    // ── Step 5: DIL validation per version ──────────────────────────────────
    // If dish is known, validate each version's appliedSwapCodes.
    // Unknown dish → dilValidation is null (no constraints to check).
    const telemetryEvents: unknown[] = [];

    const versionsWithValidation = parsed.versions.map((version) => {
      if (!dilDish || version.appliedSwapCodes.length === 0) {
        return { ...version, dilValidation: null };
      }

      const swapInputs: SwapInput[] = version.appliedSwapCodes.map((code) => ({
        code,
        // quantity unknown from LLM output — default to "significant"
        // Sprint 1 improvement: add quantity field to schema
        quantity: "significant" as const,
      }));

      const validationResult = validateSwap(dilDish, swapInputs, {
        userGoal: userGoal ?? "general",
        onEvent: (e) => {
          telemetryEvents.push(e);
          console.log(`[dil] version="${version.name}" valid=${e.isValid} violations=${e.violationCodes.join(",") || "none"}`);
        },
      });

      return { ...version, dilValidation: validationResult };
    });

    // ── Step 6: Log summary ─────────────────────────────────────────────────
    const anyBlocked = versionsWithValidation.some(
      (v) => v.dilValidation && !v.dilValidation.isValid
    );
    if (anyBlocked) {
      console.warn(
        `[dil] ⚠ violations detected for "${dishInput}" — versions may contain blocked swaps`
      );
    }

    // ── Step 7: Return ──────────────────────────────────────────────────────
    const response: GenerateResponse = {
      dish: parsed.dish,
      tagline: parsed.tagline,
      dilDishId: dilDish?.id ?? null,
      dilRecognised: !!dilDish,
      versions: versionsWithValidation as GenerateResponse["versions"],
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[generate] unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
ENDOFFILE

echo "✅ Done. Now run: npm install zod"
