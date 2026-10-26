"use client";

import { useEffect, useRef, useState } from "react";
import type { WiseDishResponse, RecipeVersion, SliderValues } from "@/lib/wisedish/types";
import { generateQuickCloseMatch, postSwap, streamGenerateFull, type SwapIntent } from "@/lib/wisedish/clientGenerate";
import type { GenerateApiRequestBody } from "@/lib/wisedish/apiContract";
import { importRecipeFromUrl } from "@/lib/import/clientImport";
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
import { bestProteinGain, getBakedExample } from "@/lib/wisedish/examples";
import { humanizeGenerateError } from "@/lib/wisedish/userFacingErrors";
import { track } from "@/lib/analytics";
import HeroSection, { type HeroExample } from "./HeroSection";
import OfflineBanner from "./OfflineBanner";
import InputLab from "./InputLab";
import ResultsPreview from "./ResultsPreview";
import HowItWorks from "./HowItWorks";
import WhyWiseDish from "./WhyWiseDish";
import type { ModeId } from "./InputLab";

const EXAMPLE_CHIPS = ["Mac & Cheese", "Biryani", "Ramen", "Chicken Tikka", "Pad Thai", "Birria Tacos", "Alfredo"];

/** Hero chips: real numbers from the baked examples when available, otherwise these fallbacks. */
const HERO_EXAMPLES: { dish: string; emoji: string; fallbackGainG: number }[] = [
  { dish: "Biryani", emoji: "🍛", fallbackGainG: 34 },
  { dish: "Birria Tacos", emoji: "🌮", fallbackGainG: 28 },
  { dish: "Pad Thai", emoji: "🍜", fallbackGainG: 22 },
];

function createResultId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `res-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type VersionId = RecipeVersion["id"];
type StreamingSlots = [RecipeVersion | null, RecipeVersion | null, RecipeVersion | null];

const DEFAULT_SLIDERS: SliderValues = {
  tasteIntegrity: 8,
  proteinBoost: 6,
  pantryRealism: 8,
};

const RECOMMENDED_SLIDERS: Record<ModeId, SliderValues> = {
  wisedish: DEFAULT_SLIDERS,
  lean: { tasteIntegrity: 7, proteinBoost: 4, pantryRealism: 7 },
};

/** How long a quick Close Match preview may take before we stop waiting for it. */
const QUICK_PREVIEW_TIMEOUT_MS = 45_000;

type ImportContext = {
  source: "youtube" | "tiktok";
  originalTitle: string;
  confidence: "high" | "medium" | "low";
  ingredients: string[];
  instructions: string[];
};

type GenerateSource = "typed" | "example" | "disambiguation" | "retry" | "regenerate";

type Notice = {
  title: string;
  subtitle?: string;
  actionLabel: string;
  onAction: () => void;
};

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

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function errorCategory(raw: string): string {
  const friendly = humanizeGenerateError(raw) ?? raw;
  if (/connection/i.test(friendly)) return "offline";
  if (/too many/i.test(friendly)) return "rate_limited";
  if (/too long/i.test(friendly)) return "timeout";
  if (/incomplete/i.test(friendly)) return "bad_output";
  if (/server|hiccup/i.test(friendly)) return "server";
  return "other";
}

export default function WiseDishApp() {
  const [mode, setMode] = useState<ModeId>("wisedish");
  const [addVeggies, setAddVeggies] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [inputDish, setInputDish] = useState("");
  const [servings, setServings] = useState<1 | 2 | 4 | 6 | 8>(1);
  const [previewServings, setPreviewServings] = useState<number>(1);
  const [sliders, setSliders] = useState<SliderValues>(DEFAULT_SLIDERS);

  const [response, setResponse] = useState<WiseDishResponse | null>(null);
  /** While generating: slot 0 fills early if the quick Close Match preview lands first. */
  const [streamingVersions, setStreamingVersions] = useState<StreamingSlots | null>(null);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [resultId, setResultId] = useState<string>(createResultId);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importContext, setImportContext] = useState<ImportContext | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingVersionId, setRegeneratingVersionId] = useState<VersionId | null>(null);
  const [swapNotes, setSwapNotes] = useState<Partial<Record<VersionId, string>>>({});
  /** Save key (normalized dish name) of the result on screen, so swaps update the same saved recipe. */
  const [savedDishKey, setSavedDishKey] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [disambiguationOptions, setDisambiguationOptions] = useState<{
    assumed: string | null;
    variants: string[];
  } | null>(null);
  const [heroExamples] = useState<HeroExample[]>(() =>
    HERO_EXAMPLES.map(({ dish, emoji, fallbackGainG }) => ({
      dish,
      emoji,
      gainG: bestProteinGain(getBakedExample(dish, "wisedish")) ?? fallbackGainG,
    }))
  );

  /** Bumped whenever results are replaced, so in-flight requests don't repopulate stale results. */
  const resultsGenerationKey = useRef(0);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const inputCardRef = useRef<HTMLDivElement | null>(null);

  const isBusy = isGenerating || regeneratingVersionId !== null || isImporting;
  const thirdVersionLabel = mode === "lean" ? "Fully Light" : "Full Send";
  const sliderKey = JSON.stringify({
    tasteIntegrity: sliders.tasteIntegrity,
    proteinBoost: sliders.proteinBoost,
    pantryRealism: sliders.pantryRealism,
  });

  const scrollToResults = () => {
    window.requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const showResponse = (next: WiseDishResponse, nextNotice: Notice | null) => {
    resultsGenerationKey.current += 1;
    setResponse(next);
    setStreamingVersions(null);
    setPreviewServings(servings);
    setResultId(createResultId());
    setSwapNotes({});
    setError(null);
    setImportContext(null);
    setDisambiguationOptions(null);
    setNotice(nextNotice);
  };

  const savedNotice = (saved: SavedRecipe): Notice => ({
    title: `Showing your saved ${saved.displayName} transformation`,
    subtitle: saved.servings !== servings ? `Scaled to ${servings} servings` : undefined,
    actionLabel: "Regenerate ↺",
    onAction: () => {
      deleteRecipe(saved.id);
      void handleGenerateAll({ forceFresh: true, dish: saved.dishName, source: "regenerate" });
    },
  });

  const applySavedRecipe = (saved: SavedRecipe) => {
    setInputDish(saved.displayName);
    setSavedDishKey(saved.dishName);
    showResponse(
      {
        inputDish: saved.displayName,
        assumptions: [],
        versions: saved.versions as [RecipeVersion, RecipeVersion, RecipeVersion],
        ...(saved.classification ? { classificationFull: saved.classification } : {}),
      },
      savedNotice(saved)
    );
  };

  // Open a recipe picked on the My recipes page.
  useEffect(() => {
    void (async () => {
      await initRecipeLogNativeStorage();
      const selectedId = takeSelectedRecipeId();
      if (!selectedId) return;
      const selected = getSavedRecipes().find((r) => r.id === selectedId);
      if (!selected) return;
      setMode(selected.mode === "lean" ? "lean" : "wisedish");
      try {
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
      } catch {
        /* keep current sliders */
      }
      applySavedRecipe(selected);
      track("saved_recipe_opened", { dish: selected.dishName });
    })();
    // Runs once on mount; applySavedRecipe only reads stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChangeSlider = <K extends keyof SliderValues>(key: K, value: number) => {
    setSliders((prev) => ({ ...prev, [key]: value }));
  };

  async function handleGenerateAll(opts: { forceFresh?: boolean; dish?: string; source?: GenerateSource } = {}) {
    const source = opts.source ?? "typed";
    const dishInputStart = (opts.dish ?? inputDish).trim();
    if (!dishInputStart) {
      setError("Enter a dish name first.");
      return;
    }
    const normalised = dishInputStart.toLowerCase();
    setDisambiguationOptions(null);

    if (!opts.forceFresh && !isUrl(dishInputStart)) {
      const existing = getSavedRecipe(normalised, mode, sliderKey) ?? getLatestSavedRecipeByDishMode(normalised, mode);
      if (existing) {
        applySavedRecipe(existing);
        track("saved_recipe_opened", { dish: normalised });
        scrollToResults();
        return;
      }
    }

    resultsGenerationKey.current += 1;
    const genKey = resultsGenerationKey.current;
    const isCurrent = () => genKey === resultsGenerationKey.current;
    const startedAt = now();

    setNotice(null);
    setIsGenerating(true);
    setGenerationStartedAt(Date.now());
    setIsImporting(false);
    setError(null);
    setResponse(null);
    setStreamingVersions([null, null, null]);
    setResultId(createResultId());
    setSwapNotes({});
    scrollToResults();
    track("generate_started", { dish: normalised.slice(0, 60), mode, source });

    let dishForGenerate = dishInputStart;
    const savedForClassification = !isUrl(dishInputStart) ? getLatestSavedRecipeByDishMode(normalised, mode) : null;
    let importedRecipe: GenerateApiRequestBody["importedRecipe"];

    if (isUrl(dishInputStart)) {
      setIsImporting(true);
      const importRes = await importRecipeFromUrl(dishInputStart);
      if (!isCurrent()) return;
      setIsImporting(false);
      if (!importRes.ok) {
        setStreamingVersions(null);
        setError(importRes.error);
        setIsGenerating(false);
        track("generate_failed", { reason: "import", mode });
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
        track("generate_failed", { reason: "import_no_recipe", mode });
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
      setImportContext({
        source: importRes.data.source,
        originalTitle: importRes.data.originalTitle,
        confidence: importRes.data.confidence,
        ingredients: importRes.data.ingredients,
        instructions: importRes.data.instructions,
      });
    } else {
      setImportContext(null);
    }

    const requestBody: GenerateApiRequestBody = {
      dish: dishForGenerate,
      servings,
      sliders,
      overridesByVersion: {},
      transformationMode: mode,
      addVeggies,
      importedRecipe,
      cachedClassification: savedForClassification?.classification,
    };

    // Quick Close Match preview and the full three-version run start together; whichever is
    // useful first is shown. (Previously the full run waited for the preview.)
    let fullDone = false;
    void withTimeout(generateQuickCloseMatch(requestBody), QUICK_PREVIEW_TIMEOUT_MS).then((quick) => {
      if (!quick || fullDone || !isCurrent()) return;
      if ("needsDisambiguation" in quick) return; // the full request reports this too
      if (quick.ok) {
        setStreamingVersions((prev) => (prev ? [quick.version, prev[1], prev[2]] : prev));
        track("generate_quick_ready", { ms: Math.round(now() - startedAt) });
      }
    });

    const r = await streamGenerateFull(requestBody, {
      onVersion: (index, version) => {
        if (!isCurrent()) return;
        setStreamingVersions((prev) => {
          const base: StreamingSlots = prev ?? [null, null, null];
          const next: StreamingSlots = [...base];
          if (index >= 0 && index < 3) next[index] = version;
          return next;
        });
      },
    });
    fullDone = true;
    if (!isCurrent()) return;

    setPreviewServings(servings);
    setStreamingVersions(null);
    setIsGenerating(false);
    setGenerationStartedAt(null);

    if ("needsDisambiguation" in r) {
      setDisambiguationOptions({ assumed: r.assumedVariant, variants: r.possibleVariants });
      inputCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if ("ok" in r && r.ok) {
      setResponse(r.data);
      const savedAt = Date.now();
      const dishNormalized = dishForGenerate.trim().toLowerCase();
      setSavedDishKey(dishNormalized);
      saveRecipe({
        id: `${dishNormalized}_${mode}_${savedAt}`,
        dishName: dishNormalized,
        displayName: r.data.inputDish || dishForGenerate,
        mode,
        servings,
        savedAt,
        versions: r.data.versions,
        tagline: "Three versions. Pick your trade-off.",
        source: importedRecipe?.source ?? "typed",
        sliderKey,
        classification: r.data.classificationFull,
      });
      track("generate_succeeded", { ms: Math.round(now() - startedAt), dish: dishNormalized.slice(0, 60), mode });
    } else if ("error" in r) {
      setError(r.error);
      track("generate_failed", { reason: errorCategory(r.error), mode });
    }
  }

  const handleSwapIngredient = async (
    versionId: VersionId,
    ingredientId: string,
    request: { intent: SwapIntent; replacement?: string }
  ) => {
    if (!response) return;
    const index = response.versions.findIndex((v) => v.id === versionId);
    const version = response.versions[index];
    const ingredient = version?.ingredients.find((i) => i.id === ingredientId);
    if (!version || !ingredient || index < 0) return;

    const genKey = resultsGenerationKey.current;
    setRegeneratingVersionId(versionId);
    setError(null);
    track("swap_requested", { intent: request.intent, tier: versionId });

    const r = await postSwap({
      dish: response.inputDish || inputDish,
      transformationMode: mode,
      servings,
      versionIndex: index as 0 | 1 | 2,
      version,
      ingredient: { name: ingredient.current, amount: ingredient.amount },
      intent: request.intent,
      replacement: request.replacement,
      importedRecipe: importContext
        ? {
            ingredients: importContext.ingredients,
            instructions: importContext.instructions,
            source: importContext.source,
            originalTitle: importContext.originalTitle,
            confidence: importContext.confidence,
          }
        : undefined,
      cachedClassification: response.classificationFull,
    });

    if (genKey !== resultsGenerationKey.current) {
      setRegeneratingVersionId(null);
      return;
    }
    if (r.ok) {
      const versions = [...response.versions] as WiseDishResponse["versions"];
      versions[index] = { ...r.version, label: version.label };
      const next: WiseDishResponse = { ...response, versions };
      setResponse(next);
      setSwapNotes((prev) => ({ ...prev, [versionId]: r.swapNote || "Swapped." }));
      const dishNormalized = savedDishKey || (response.inputDish || inputDish).trim().toLowerCase();
      saveRecipe({
        id: `${dishNormalized}_${mode}_${Date.now()}`,
        dishName: dishNormalized,
        displayName: response.inputDish || inputDish,
        mode,
        servings,
        savedAt: Date.now(),
        versions,
        tagline: "Three versions. Pick your trade-off.",
        source: importContext?.source ?? "typed",
        sliderKey,
        classification: response.classificationFull,
      });
      track("swap_succeeded", { intent: request.intent, tier: versionId });
    } else {
      setError(r.error);
      track("swap_failed", { intent: request.intent, reason: errorCategory(r.error) });
    }
    setRegeneratingVersionId(null);
  };

  /** Example chips and hero chips: instant baked result if we have one, otherwise generate right away. */
  const openExample = (dish: string) => {
    const normalizedDish = dish.toLowerCase();
    setInputDish(normalizedDish);
    const saved = getLatestSavedRecipeByDishMode(normalizedDish, mode);
    if (saved) {
      applySavedRecipe(saved);
      track("example_opened", { dish: normalizedDish, instant: "saved" });
      scrollToResults();
      return;
    }
    const baked = getBakedExample(dish, mode);
    if (baked) {
      setSavedDishKey(normalizedDish);
      showResponse(baked, {
        title: `Example: ${dish}`,
        subtitle: "Pre-made so you can see it instantly. Make your own for fresh ideas and swaps.",
        actionLabel: "Make a fresh one ↺",
        onAction: () => void handleGenerateAll({ forceFresh: true, dish: normalizedDish, source: "regenerate" }),
      });
      track("example_opened", { dish: normalizedDish, instant: "baked" });
      scrollToResults();
      return;
    }
    track("example_opened", { dish: normalizedDish, instant: "none" });
    void handleGenerateAll({ dish: normalizedDish, source: "example" });
  };

  const onChangeMode = (next: ModeId) => {
    if (next === mode) return;
    const hasResults = Boolean(response || streamingVersions?.some(Boolean));
    if (hasResults && !window.confirm("Switching mode clears your current results. Continue?")) {
      return;
    }
    resultsGenerationKey.current += 1;
    setMode(next);
    setSliders(RECOMMENDED_SLIDERS[next]);
    setShowAdvanced(false);
    setResponse(null);
    setStreamingVersions(null);
    setError(null);
    setImportContext(null);
    setRegeneratingVersionId(null);
    setIsGenerating(false);
    setGenerationStartedAt(null);
    setNotice(null);
    setSwapNotes({});
  };

  return (
    <div className="flex flex-col">
      <OfflineBanner />
      <HeroSection examples={heroExamples} onTryExample={openExample} disabled={isBusy} />
      <div ref={inputCardRef}>
        <InputLab
          inputDish={inputDish}
          sliders={sliders}
          onChangeDish={setInputDish}
          onChangeSlider={onChangeSlider}
          mode={mode}
          onChangeMode={onChangeMode}
          addVeggies={addVeggies}
          onAddVeggiesChange={setAddVeggies}
          servings={servings}
          onChangeServings={setServings}
          thirdVersionLabel={thirdVersionLabel}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced((v) => !v)}
          onGenerate={() => void handleGenerateAll()}
          chips={EXAMPLE_CHIPS}
          onPickExample={openExample}
          isGenerating={isGenerating}
          isImporting={isImporting}
          disabled={isBusy}
          disambiguationOptions={disambiguationOptions}
          onPickDisambiguationVariant={(variant) => {
            setInputDish(variant);
            void handleGenerateAll({ forceFresh: true, dish: variant, source: "disambiguation" });
          }}
          onDisambiguationOther={() => {
            setDisambiguationOptions(null);
            setError(null);
          }}
        />
      </div>

      <div ref={resultsRef} className="mt-2 scroll-mt-20">
        <ResultsPreview
          response={response}
          classification={response?.classification ?? null}
          onRetryWrongDish={() => void handleGenerateAll({ forceFresh: true, source: "regenerate" })}
          streamingVersions={streamingVersions}
          generationStartedAt={generationStartedAt}
          isImporting={isImporting}
          resultId={resultId}
          dish={response?.inputDish || inputDish}
          transformationMode={mode}
          servings={servings}
          previewServings={previewServings}
          onChangePreviewServings={setPreviewServings}
          error={error}
          importAttribution={
            importContext ? { source: importContext.source, originalTitle: importContext.originalTitle } : null
          }
          showLowConfidenceImportNotice={importContext?.source === "tiktok" && importContext.confidence === "low"}
          isGenerating={isGenerating}
          regeneratingVersionId={regeneratingVersionId}
          swapNotes={swapNotes}
          onSwapIngredient={(versionId, ingredientId, request) =>
            void handleSwapIngredient(versionId, ingredientId, request)
          }
          cacheNotice={
            notice
              ? {
                  ...notice,
                  actionDisabled: isBusy,
                }
              : null
          }
          onRegenerateAll={() => void handleGenerateAll({ forceFresh: true, source: "regenerate" })}
          onRetry={() => void handleGenerateAll({ forceFresh: true, source: "retry" })}
        />
      </div>

      <HowItWorks />
      <WhyWiseDish />
    </div>
  );
}
