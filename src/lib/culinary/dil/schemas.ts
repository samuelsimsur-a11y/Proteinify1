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
