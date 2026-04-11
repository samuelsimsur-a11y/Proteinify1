"use client";

import { useState } from "react";
import type {
  IngredientOverride,
  ProteinifyResponse,
  RecipeVersion,
  SliderValues,
} from "@/lib/proteinify/types";
import { postGenerate, streamGenerateFull } from "@/lib/proteinify/clientGenerate";
import HeroSection from "./HeroSection";
import InputLab from "./InputLab";
import ResultsPreview from "./ResultsPreview";
import HowItWorks from "./HowItWorks";
import WhyProteinify from "./WhyProteinify";
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

function emptyOverrides(): Record<VersionId, IngredientOverride[]> {
  return {
    "close-match": [],
    balanced: [],
    "max-protein": [],
  };
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

export default function ProteinifyApp() {
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

  /** Used only for retry flows that don't already have a response. */
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingVersionId, setRegeneratingVersionId] = useState<VersionId | null>(null);

  const isBusy = isGenerating || isInitialLoading || regeneratingVersionId !== null;

  const recommendedSlidersByMode: Record<ModeId, SliderValues> = {
    proteinify: DEFAULT_SLIDERS,
    lean: { tasteIntegrity: 7, proteinBoost: 4, pantryRealism: 7 },
  };

  const thirdVersionLabel = mode === "lean" ? "Fully Light" : "Full Send";

  const onChangeSlider = <K extends keyof SliderValues>(key: K, value: number) => {
    setSliders((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerateAll = async () => {
    setIsGenerating(true);
    setError(null);
    setResponse(null);
    setStreamingVersions([buildFastCloseMatchDraft(inputDish), null, null]);
    setResultId(createResultId());
    setOverridesByVersion(emptyOverrides());
    const r = await streamGenerateFull(
      {
        dish: inputDish,
        servings,
        sliders,
        overridesByVersion: toApiOverrides(emptyOverrides()),
        transformationMode: mode,
        addVeggies,
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
    if (r.ok) {
      setResponse(r.data);
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
    const r = await postGenerate({
      dish: inputDish,
      servings,
      sliders,
      targetVersion: versionId,
      previousResponse: response,
      overridesByVersion: toApiOverrides(nextMap),
      transformationMode: mode,
      addVeggies,
    });
    if (r.ok) {
      setResponse(r.data);
      setPreviewServings(servings);
      setResultId(createResultId());
    } else {
      setError(r.error);
    }
    setRegeneratingVersionId(null);
  };

  const onPickExample = (dish: string) => {
    setInputDish(dish.toLowerCase());
  };

  const handleRetryAfterError = async () => {
    setError(null);
    if (!response) {
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
      if (r.ok) {
        setResponse(r.data);
      } else {
        setError(r.error);
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
          setMode(next);
          setSliders(recommendedSlidersByMode[next]);
          setOverridesByVersion(emptyOverrides());
          setShowAdvanced(false);
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
        disabled={isBusy}
      />

      <div className="mt-2">
        <ResultsPreview
          response={response}
          streamingVersions={streamingVersions}
          resultId={resultId}
          dish={inputDish}
          servings={servings}
          previewServings={previewServings}
          onChangePreviewServings={setPreviewServings}
          thirdVersionLabel={thirdVersionLabel}
          error={error}
          isInitialLoading={isInitialLoading}
          isGenerating={isGenerating}
          regeneratingVersionId={regeneratingVersionId}
          onSwapIngredient={handleSwapIngredient}
          onRegenerateAll={() => void handleGenerateAll()}
          onRetry={handleRetryAfterError}
        />
      </div>

      <HowItWorks />
      <WhyProteinify />
    </div>
  );
}
