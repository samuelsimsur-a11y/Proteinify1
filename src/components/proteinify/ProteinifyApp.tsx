"use client";

import { useEffect, useRef, useState } from "react";
import type {
  IngredientOverride,
  ProteinifyResponse,
  RecipeVersion,
  SliderValues,
} from "@/lib/proteinify/types";
import { generateQuickCloseMatch, postGenerate, streamGenerateFull } from "@/lib/proteinify/clientGenerate";
import { GENERATE_ENDPOINT } from "@/lib/proteinify/clientGenerate";
import { importRecipeFromUrl } from "@/lib/import/clientImport";
import { IMPORT_ENDPOINT } from "@/lib/import/clientImport";
import {
  deleteRecipe,
  getLatestSavedRecipeByDishMode,
  getSavedRecipe,
  getSavedRecipes,
  initRecipeLogNativeStorage,
  saveRecipe,
  takeSelectedRecipeId,
  type SavedRecipe,
} from "@/lib/recipeLog";
import { getApiRequestEndpointCandidates, getResolvedApiBase } from "@/lib/apiBaseUrl";
import HeroSection from "./HeroSection";
import InputLab from "./InputLab";
import ResultsPreview from "./ResultsPreview";
import HowItWorks from "./HowItWorks";
import WhyWiseDish from "./WhyProteinify";
import type { ModeId } from "./InputLab";

const EXAMPLE_CHIPS = [
  "Mac & Cheese",
  "Biryani",
  "Ramen",
  "Chicken Tikka",
  "Pad Thai",
  "Birria Tacos",
  "Alfredo",
];

function createResultId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `res-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type VersionId = "close-match" | "balanced" | "max-protein";

const DEFAULT_SLIDERS: SliderValues = {
  tasteIntegrity: 8,
  proteinBoost: 6,
  pantryRealism: 8,
};

const DEFAULT_DISH = "mac and cheese";
const PERF_KEY = "wisedish_generate_perf_samples_v1";
const LEGACY_PERF_KEY = "foodzap_generate_perf_samples_v1";
const MAX_PERF_SAMPLES = 40;

function emptyOverrides(): Record<VersionId, IngredientOverride[]> {
  return {
    "close-match": [],
    balanced: [],
    "max-protein": [],
  };
}

type PerfSample = {
  at: number;
  dish: string;
  cacheHit: boolean;
  quickMs?: number;
  fullMs?: number;
};

function readPerfSamples(): PerfSample[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PERF_KEY) ?? window.localStorage.getItem(LEGACY_PERF_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => x && typeof x === "object") as PerfSample[];
  } catch {
    return [];
  }
}

function writePerfSamples(samples: PerfSample[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PERF_KEY, JSON.stringify(samples.slice(-MAX_PERF_SAMPLES)));
  } catch {
    // ignore storage failures
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

function toApiOverrides(o: Record<VersionId, IngredientOverride[]>) {
  return {
    "close-match": o["close-match"],
    balanced: o.balanced,
    "max-protein": o["max-protein"],
  };
}

function toIngredientId(name: string, i: number): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ing"}-${i + 1}`;
}

function isUrl(input: string): boolean {
  const v = input.trim().toLowerCase();
  return (
    v.startsWith("http://") ||
    v.startsWith("https://") ||
    v.includes("tiktok.com") ||
    v.includes("youtu.be") ||
    v.includes("youtube.com")
  );
}

function buildFastCloseMatchDraft(dish: string): RecipeVersion {
  const dishLower = dish.toLowerCase();
  const looksBrothy =
    dishLower.includes("ramen") ||
    dishLower.includes("pho") ||
    dishLower.includes("soup") ||
    dishLower.includes("broth");

  const ingredients = looksBrothy
    ? [
        { name: "Chicken stock (unsalted or low-sodium)", amount: "500ml", reason: "Base — broth body" },
        { name: "Soy sauce + mirin (tare)", amount: "2 tbsp + 1 tbsp", reason: "Base — shoyu seasoning" },
        { name: "Fresh ramen noodles", amount: "120g", reason: "Base — structure" },
        { name: "Chicken thigh or breast", amount: "140–180g", reason: "Base + boost — primary protein" },
        { name: "Neutral oil, garlic, ginger", amount: "2 tbsp + 2 cloves + 1 tsp", reason: "Base — quick aroma oil" },
        { name: "Scallions, optional nori", amount: "2 tbsp + 1 sheet", reason: "Base — garnish" },
      ]
    : [
        { name: "Primary protein", amount: "140g", reason: "Increase native protein first" },
        { name: "Main carb base", amount: "100g", reason: "Keep recognizable structure" },
        { name: "Core sauce/base", amount: "1 portion", reason: "Preserve dish identity" },
      ];

  const steps = looksBrothy
    ? [
        "Simmer stock with a spoon of dried mushrooms or a splash of fish sauce if you have it — optional depth while you prep noodles and protein.",
        "Whisk tare into hot stock; taste for salt. You want a savory, slightly sweet shoyu profile, not thin salted water.",
        "Cook noodles to package time, drain, and divide into bowls. Cook chicken separately (sear or simmer) until done; slice.",
        "Warm oil with garlic/ginger 2–3 minutes, strain — drizzle a little over each bowl for aroma.",
        "Pour broth over noodles, top with chicken and scallions. Full three-version output will refine protein targets and swaps.",
      ]
    : [
        "Keep the dish structure and flavor base unchanged where possible.",
        "Increase primary protein first using coherent same-dish moves.",
        "Apply one low-visibility optimization if needed while preserving texture.",
      ];

  return {
    id: "close-match",
    label: "Close Match",
    summary: "Fast draft while full optimization runs",
    macros: { p: 0, d: 0 },
    totalProteinG: 0,
    swapSummary: ["Draft preview", "Identity-first protein move"],
    mealPrepNote: null,
    proteinMathWarning: null,
    cookTimeMinutes: 30,
    difficulty: "Medium",
    tasteScore: 8,
    realismScore: 8,
    aggressivenessScore: 4,
    why: "Building a quick first-pass close-match while the full three-version result is generated.",
    adds: [],
    transformationByComponent: looksBrothy
      ? {
          protein: ["More chicken first; egg only if it fits the bowl grammar"],
          carbBase: ["Keep noodles recognizable; blends come in real tiers"],
          sauceBroth: ["Tare + stock depth, not salty water"],
          fat: ["Small aroma oil hit, not a puddle"],
          toppings: ["Scallions / nori as usual"],
        }
      : {
          protein: ["Grow the anchor protein before powders"],
          carbBase: ["Hold starch identity"],
          sauceBroth: [],
          fat: ["Trim finishing fat only if safe"],
          toppings: [],
        },
    methodAdjustments: steps.slice(0, Math.min(5, steps.length)),
    ingredients: ingredients.map((ing, i) => ({
      id: toIngredientId(ing.name, i),
      original: ing.name,
      current: ing.name,
      amount: ing.amount,
      reason: ing.reason,
      swapOptions: [
        {
          type: "more-authentic",
          label: "Keep original style",
          replacement: ing.name,
          effect: "Preserves dish identity",
        },
        {
          type: "higher-protein",
          label: "Higher protein variant",
          replacement: `${ing.name} (higher protein)`,
          effect: "Increases protein density",
        },
      ],
    })),
    steps,
  };
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return await Promise.race([
    p,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}

export default function WiseDishApp() {
  const showDebugOverlay = process.env.NODE_ENV !== "production";
  const [mode, setMode] = useState<ModeId>("proteinify");
  const [addVeggies, setAddVeggies] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [inputDish, setInputDish] = useState<string>(DEFAULT_DISH);
  const [servings, setServings] = useState<1 | 2 | 4 | 6 | 8>(1);
  const [previewServings, setPreviewServings] = useState<number>(1);
  const [sliders, setSliders] = useState<SliderValues>(DEFAULT_SLIDERS);
  const [overridesByVersion, setOverridesByVersion] =
    useState<Record<VersionId, IngredientOverride[]>>(emptyOverrides);

  const [response, setResponse] = useState<ProteinifyResponse | null>(null);
  /** During full generate: three slots fill in order (Close Match → Balanced → Full Send). */
  const [streamingVersions, setStreamingVersions] = useState<
    [RecipeVersion | null, RecipeVersion | null, RecipeVersion | null] | null
  >(null);
  const [resultId, setResultId] = useState<string>(createResultId());
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importContext, setImportContext] = useState<{
    source: "youtube" | "tiktok";
    originalTitle: string;
    confidence: "high" | "medium" | "low";
    ingredients: string[];
    instructions: string[];
  } | null>(null);

  /** Used only for retry flows that don't already have a response. */
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingVersionId, setRegeneratingVersionId] = useState<VersionId | null>(null);
  const [isRefreshingFromCache, setIsRefreshingFromCache] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [cachedRecipeMeta, setCachedRecipeMeta] = useState<{ id: string; displayName: string; savedServings: number } | null>(
    null
  );
  const [perfSummary, setPerfSummary] = useState<{
    lastQuickMs?: number;
    lastFullMs?: number;
    p50Ms?: number;
    p95Ms?: number;
    samples: number;
  } | null>(null);

  /** Bumped on mode change so in-flight generates don’t repopulate stale results. */
  const resultsGenerationKey = useRef(0);

  const isBusy = isGenerating || isInitialLoading || regeneratingVersionId !== null || isImporting;

  const recommendedSlidersByMode: Record<ModeId, SliderValues> = {
    proteinify: DEFAULT_SLIDERS,
    lean: { tasteIntegrity: 7, proteinBoost: 4, pantryRealism: 7 },
  };

  const thirdVersionLabel = mode === "lean" ? "Fully Light" : "Full Send";
  const resolvedApiBase =
    getResolvedApiBase() || (typeof window !== "undefined" ? window.location.origin : "(unknown)");
  const generateEndpoints =
    typeof window !== "undefined" ? getApiRequestEndpointCandidates("/api/generate") : [];
  const importEndpoints =
    typeof window !== "undefined" ? getApiRequestEndpointCandidates("/api/import") : [];
  const sliderKey = JSON.stringify({
    tasteIntegrity: sliders.tasteIntegrity,
    proteinBoost: sliders.proteinBoost,
    pantryRealism: sliders.pantryRealism,
  });

  useEffect(() => {
    void (async () => {
      await initRecipeLogNativeStorage();
      const selectedId = takeSelectedRecipeId();
      if (!selectedId) return;
      const selected = getSavedRecipes().find((r) => r.id === selectedId);
      if (!selected) return;
      setInputDish(selected.displayName);
      setMode(selected.mode as ModeId);
      const parsed = JSON.parse(selected.sliderKey ?? "{}") as Partial<SliderValues>;
      if (
        typeof parsed.tasteIntegrity === "number" &&
        typeof parsed.proteinBoost === "number" &&
        typeof parsed.pantryRealism === "number"
      ) {
        setSliders({
          tasteIntegrity: parsed.tasteIntegrity,
          proteinBoost: parsed.proteinBoost,
          pantryRealism: parsed.pantryRealism,
        });
      }
      setResponse({
        inputDish: selected.displayName,
        assumptions: [],
        versions: selected.versions as [RecipeVersion, RecipeVersion, RecipeVersion],
      });
      setPreviewServings(servings);
      setFromCache(true);
      setCachedRecipeMeta({ id: selected.id, displayName: selected.displayName, savedServings: selected.servings });
    })();
  }, [servings]);

  const onChangeSlider = <K extends keyof SliderValues>(key: K, value: number) => {
    setSliders((prev) => ({ ...prev, [key]: value }));
  };

  const applySavedRecipeToView = (saved: SavedRecipe, targetDish?: string) => {
    setResponse({
      inputDish: saved.displayName,
      assumptions: [],
      versions: saved.versions as [RecipeVersion, RecipeVersion, RecipeVersion],
    });
    setPreviewServings(servings);
    setFromCache(true);
    setCachedRecipeMeta({ id: saved.id, displayName: saved.displayName, savedServings: saved.servings });
    setError(null);
    setImportContext(null);
    setStreamingVersions(null);
    if (targetDish) setInputDish(targetDish);
  };

  const recordPerf = (sample: PerfSample) => {
    const samples = [...readPerfSamples(), sample].slice(-MAX_PERF_SAMPLES);
    writePerfSamples(samples);
    const fullValues = samples
      .map((s) => s.fullMs)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
    setPerfSummary({
      lastQuickMs: sample.quickMs,
      lastFullMs: sample.fullMs,
      p50Ms: fullValues.length ? percentile(fullValues, 50) : undefined,
      p95Ms: fullValues.length ? percentile(fullValues, 95) : undefined,
      samples: fullValues.length,
    });
  };

  useEffect(() => {
    const samples = readPerfSamples();
    const fullValues = samples
      .map((s) => s.fullMs)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
    if (fullValues.length === 0) return;
    const last = samples[samples.length - 1];
    setPerfSummary({
      lastQuickMs: last?.quickMs,
      lastFullMs: last?.fullMs,
      p50Ms: percentile(fullValues, 50),
      p95Ms: percentile(fullValues, 95),
      samples: fullValues.length,
    });
  }, []);

  const handleGenerateAll = async (forceFresh: boolean = false) => {
    const perfStart = typeof performance !== "undefined" ? performance.now() : Date.now();
    let quickElapsedMs: number | undefined;
    const normalised = inputDish.trim().toLowerCase();
    if (!forceFresh && !isUrl(inputDish) && normalised) {
      const existing =
        getSavedRecipe(normalised, mode, sliderKey) ?? getLatestSavedRecipeByDishMode(normalised, mode);
      if (existing) {
        applySavedRecipeToView(existing, normalised);
        recordPerf({ at: Date.now(), dish: normalised, cacheHit: true });
        return;
      }
    }
    setFromCache(false);
    setCachedRecipeMeta(null);
    resultsGenerationKey.current += 1;
    const genKey = resultsGenerationKey.current;
    setIsGenerating(true);
    setIsImporting(false);
    setError(null);
    setResponse(null);
    setStreamingVersions([buildFastCloseMatchDraft(inputDish), null, null]);
    setResultId(createResultId());
    setOverridesByVersion(emptyOverrides());
    let dishForGenerate = inputDish;
    let importedRecipe:
      | {
          ingredients: string[];
          instructions: string[];
          source: "youtube" | "tiktok";
          originalTitle: string;
          confidence: "high" | "medium" | "low";
        }
      | undefined;

    if (isUrl(inputDish)) {
      setIsImporting(true);
      const importRes = await importRecipeFromUrl(inputDish);
      setIsImporting(false);
      if (!importRes.ok) {
        setStreamingVersions(null);
        setError(importRes.error);
        setIsGenerating(false);
        return;
      }
      if (!importRes.data.foundRecipe) {
        setStreamingVersions(null);
        setError(importRes.data.message);
        setImportContext({
          source: importRes.data.source,
          originalTitle: importRes.data.originalTitle,
          confidence: importRes.data.confidence,
          ingredients: [],
          instructions: [],
        });
        setIsGenerating(false);
        return;
      }
      dishForGenerate = importRes.data.dishName;
      importedRecipe = {
        ingredients: importRes.data.ingredients,
        instructions: importRes.data.instructions,
        source: importRes.data.source,
        originalTitle: importRes.data.originalTitle,
        confidence: importRes.data.confidence,
      };
      setInputDish(importRes.data.dishName);
      setImportContext(importedRecipe);
    } else {
      setImportContext(null);
    }
    const quickStart = typeof performance !== "undefined" ? performance.now() : Date.now();
    const quickClose = await withTimeout(
      generateQuickCloseMatch({
        dish: dishForGenerate,
        servings,
        sliders,
        overridesByVersion: toApiOverrides(emptyOverrides()),
        transformationMode: mode,
        addVeggies,
        importedRecipe,
      }),
              12_000
    );
    if (quickClose?.ok) {
      const quickDone = typeof performance !== "undefined" ? performance.now() : Date.now();
      quickElapsedMs = Math.max(0, quickDone - quickStart);
      setStreamingVersions((prev) => {
        const base: [RecipeVersion | null, RecipeVersion | null, RecipeVersion | null] = prev ?? [null, null, null];
        return [quickClose.version, base[1], base[2]];
      });
      setPerfSummary((prev) => ({
        ...(prev ?? { samples: 0 }),
        lastQuickMs: quickElapsedMs,
      }));
    }

    const r = await streamGenerateFull(
      {
        dish: dishForGenerate,
        servings,
        sliders,
        overridesByVersion: toApiOverrides(emptyOverrides()),
        transformationMode: mode,
        addVeggies,
        importedRecipe,
      },
      {
        onVersion: (index, version) => {
          setStreamingVersions((prev) => {
            const base: [RecipeVersion | null, RecipeVersion | null, RecipeVersion | null] = prev ?? [
              null,
              null,
              null,
            ];
            const next: typeof base = [...base];
            if (index >= 0 && index < 3) next[index] = version;
            return next;
          });
        },
      }
    );
    setPreviewServings(servings);
    setStreamingVersions(null);
    if (genKey !== resultsGenerationKey.current) {
      setIsGenerating(false);
      return;
    }
    if (r.ok) {
      setResponse(r.data);
      const now = Date.now();
      const source: SavedRecipe["source"] = importedRecipe?.source ?? "typed";
      const dishNormalized = dishForGenerate.trim().toLowerCase();
      saveRecipe({
        id: `${dishNormalized}_${mode}_${now}`,
        dishName: dishNormalized,
        displayName: r.data.inputDish || dishForGenerate,
        mode,
        servings,
        savedAt: now,
        versions: r.data.versions,
        tagline: "Three versions. Pick your trade-off.",
        source,
        sliderKey,
      });
      const perfDone = typeof performance !== "undefined" ? performance.now() : Date.now();
      recordPerf({
        at: Date.now(),
        dish: dishForGenerate.trim().toLowerCase(),
        cacheHit: false,
        quickMs: quickElapsedMs,
        fullMs: Math.max(0, perfDone - perfStart),
      });
    } else {
      setError(r.error);
    }
    setIsGenerating(false);
  };

  const handleSwapIngredient = async (
    versionId: VersionId,
    ingredientId: string,
    replacement: string
  ) => {
    if (!response) return;
    const filtered = overridesByVersion[versionId].filter((o) => o.ingredientId !== ingredientId);
    const nextForVersion = [...filtered, { ingredientId, forceReplacement: replacement }];
    const nextMap: Record<VersionId, IngredientOverride[]> = {
      ...overridesByVersion,
      [versionId]: nextForVersion,
    };
    setOverridesByVersion(nextMap);

    setRegeneratingVersionId(versionId);
    setError(null);
    const genKey = resultsGenerationKey.current;
    const r = await postGenerate({
      dish: inputDish,
      servings,
      sliders,
      targetVersion: versionId,
      previousResponse: response,
      overridesByVersion: toApiOverrides(nextMap),
      transformationMode: mode,
      addVeggies,
      importedRecipe: importContext
        ? {
            ingredients: importContext.ingredients,
            instructions: importContext.instructions,
            source: importContext.source,
            originalTitle: importContext.originalTitle,
            confidence: importContext.confidence,
          }
        : undefined,
    });
    if (genKey === resultsGenerationKey.current) {
      if (r.ok) {
        setResponse(r.data);
        setPreviewServings(servings);
        setResultId(createResultId());
        const now = Date.now();
        saveRecipe({
          id: `${inputDish.trim().toLowerCase()}_${mode}_${now}`,
          dishName: inputDish.trim().toLowerCase(),
          displayName: r.data.inputDish || inputDish,
          mode,
          servings,
          savedAt: now,
          versions: r.data.versions,
          tagline: "Three versions. Pick your trade-off.",
          source: importContext?.source ?? "typed",
          sliderKey,
        });
      } else {
        setError(r.error);
      }
    }
    setRegeneratingVersionId(null);
  };

  const onPickExample = (dish: string) => {
    const normalizedDish = dish.toLowerCase();
    const saved = getLatestSavedRecipeByDishMode(normalizedDish, mode);
    if (saved) {
      // Keep current fine-tune sliders untouched; only swap visible recipe result.
      applySavedRecipeToView(saved, normalizedDish);
      return;
    }
    setInputDish(normalizedDish);
  };

  const handleRetryAfterError = async () => {
    setError(null);
    if (!response) {
      resultsGenerationKey.current += 1;
      const genKey = resultsGenerationKey.current;
      setIsInitialLoading(true);
      setStreamingVersions([buildFastCloseMatchDraft(inputDish), null, null]);
      setResultId(createResultId());
      const r = await streamGenerateFull(
        {
          dish: inputDish,
          servings,
          sliders,
          overridesByVersion: toApiOverrides(emptyOverrides()),
          transformationMode: mode,
          addVeggies,
          importedRecipe: importContext
            ? {
                ingredients: importContext.ingredients,
                instructions: importContext.instructions,
                source: importContext.source,
                originalTitle: importContext.originalTitle,
                confidence: importContext.confidence,
              }
            : undefined,
        },
        {
          onVersion: (index, version) => {
            setStreamingVersions((prev) => {
              const base: [RecipeVersion | null, RecipeVersion | null, RecipeVersion | null] = prev ?? [
                null,
                null,
                null,
              ];
              const next: typeof base = [...base];
              if (index >= 0 && index < 3) next[index] = version;
              return next;
            });
          },
        }
      );
      setPreviewServings(servings);
      setStreamingVersions(null);
      if (genKey === resultsGenerationKey.current) {
        if (r.ok) {
          setResponse(r.data);
        } else {
          setError(r.error);
        }
      }
      setIsInitialLoading(false);
      return;
    }
    await handleGenerateAll();
  };

  return (
    <div className="flex flex-col">
      <HeroSection />
      <InputLab
        inputDish={inputDish}
        sliders={sliders}
        onChangeDish={setInputDish}
        onChangeSlider={onChangeSlider}
        mode={mode}
        onChangeMode={(next) => {
          resultsGenerationKey.current += 1;
          setMode(next);
          setSliders(recommendedSlidersByMode[next]);
          setOverridesByVersion(emptyOverrides());
          setShowAdvanced(false);
          setResponse(null);
          setStreamingVersions(null);
          setError(null);
          setImportContext(null);
          setRegeneratingVersionId(null);
          setIsGenerating(false);
          setIsInitialLoading(false);
          setFromCache(false);
          setCachedRecipeMeta(null);
        }}
        addVeggies={addVeggies}
        onAddVeggiesChange={setAddVeggies}
        thirdVersionLabel={thirdVersionLabel}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced((v) => !v)}
        onGenerate={handleGenerateAll}
        chips={EXAMPLE_CHIPS}
        onPickExample={onPickExample}
        isGenerating={isGenerating}
        isImporting={isImporting}
        disabled={isBusy}
      />

      <div className="mt-2">
        {showDebugOverlay && (error || perfSummary) ? (
          <div className="mx-auto mb-2 w-full max-w-3xl px-4 text-[11px] text-[color:var(--text-muted)]">
            Debug: base={resolvedApiBase} | generate→{generateEndpoints.join(" → ") || GENERATE_ENDPOINT} |
            import→{importEndpoints.join(" → ") || IMPORT_ENDPOINT}
            {perfSummary
              ? ` | perf lastQuick=${perfSummary.lastQuickMs ? `${(perfSummary.lastQuickMs / 1000).toFixed(1)}s` : "n/a"} lastFull=${perfSummary.lastFullMs ? `${(perfSummary.lastFullMs / 1000).toFixed(1)}s` : "n/a"} p50=${perfSummary.p50Ms ? `${(perfSummary.p50Ms / 1000).toFixed(1)}s` : "n/a"} p95=${perfSummary.p95Ms ? `${(perfSummary.p95Ms / 1000).toFixed(1)}s` : "n/a"} n=${perfSummary.samples}`
              : ""}
          </div>
        ) : null}
        <ResultsPreview
          response={response}
          streamingVersions={streamingVersions}
          resultId={resultId}
          dish={inputDish}
          transformationMode={mode}
          servings={servings}
          previewServings={previewServings}
          onChangePreviewServings={setPreviewServings}
          error={error}
          importAttribution={
            importContext
              ? {
                  source: importContext.source,
                  originalTitle: importContext.originalTitle,
                }
              : null
          }
          showLowConfidenceImportNotice={importContext?.source === "tiktok" && importContext.confidence === "low"}
          isInitialLoading={isInitialLoading}
          isGenerating={isGenerating}
          regeneratingVersionId={regeneratingVersionId}
          onSwapIngredient={handleSwapIngredient}
          cacheNotice={
            fromCache && cachedRecipeMeta
              ? {
                  title: `Showing your saved ${cachedRecipeMeta.displayName} transformation`,
                  subtitle:
                    cachedRecipeMeta.savedServings !== servings
                      ? `Showing saved transformation scaled to ${servings} servings`
                      : undefined,
                  actionLabel: "Regenerate ↺",
                  actionDisabled: isRefreshingFromCache || isGenerating || isInitialLoading,
                  onAction: () => {
                    setIsRefreshingFromCache(true);
                    deleteRecipe(cachedRecipeMeta.id);
                    setFromCache(false);
                    setCachedRecipeMeta(null);
                    void handleGenerateAll(true).finally(() => setIsRefreshingFromCache(false));
                  },
                }
              : null
          }
          onRegenerateAll={() => void handleGenerateAll(true)}
          onRetry={handleRetryAfterError}
        />
      </div>

      <HowItWorks />
      <WhyWiseDish />
    </div>
  );
}
