import type {
  Ingredient,
  IngredientOverride,
  ProteinifyResponse,
  RegenerationRequest,
  RecipeStep,
  RecipeVersion,
  TransformationByComponent,
  TransformationMode,
  SliderValues,
} from "./types";

type DishCategory =
  | "mac-and-cheese"
  | "pancakes"
  | "alfredo"
  | "burger"
  | "quesadilla"
  | "ice-cream"
  | "pizza"
  | "chicken-tenders"
  | "generic";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function round(n: number) {
  return Math.round(n);
}

function titleCase(s: string) {
  const trimmed = s.trim();
  if (!trimmed) return trimmed;
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

function detectCategory(dish: string): DishCategory {
  const d = dish.toLowerCase();
  if (d.includes("mac") && d.includes("cheese")) return "mac-and-cheese";
  if (d.includes("pancake")) return "pancakes";
  if (d.includes("alfredo")) return "alfredo";
  if (d.includes("burger")) return "burger";
  if (d.includes("quesadilla")) return "quesadilla";
  if (d.includes("ice cream") || d.includes("icecream")) return "ice-cream";
  if (d.includes("pizza")) return "pizza";
  if (d.includes("chicken") && d.includes("tender")) return "chicken-tenders";
  return "generic";
}

function baseProteinForDish(dish: string): number {
  const d = dish.toLowerCase();
  if (d.includes("mac") && d.includes("cheese")) return 18;
  if (d.includes("pancake")) return 12;
  if (d.includes("alfredo")) return 16;
  if (d.includes("burger")) return 28;
  if (d.includes("quesadilla")) return 20;
  if (d.includes("ice cream")) return 5;
  if (d.includes("pizza")) return 22;
  if (d.includes("chicken") && d.includes("tender")) return 24;
  if (/(biryani|bibimbap|kebab|shawarma|tagine|curry|masala|tikka|ramen|pho|laksa)/.test(d)) return 18;
  if (/(dosa|idli|falafel|sushi|poke|ceviche)/.test(d)) return 14;
  return 15;
}

function scoreFromSlider(sliderValue: number) {
  // Slider is 0-10, return 0-10 directly.
  return Math.max(0, Math.min(10, sliderValue));
}

function computeAggressiveness(
  sliders: SliderValues,
  version: RecipeVersion["id"]
): number {
  const proteinFactor = sliders.proteinBoost / 10; // 0..1
  const tasteEscape = (10 - sliders.tasteIntegrity) / 10; // low tasteIntegrity => more aggressive
  const pantryPenalty = (10 - sliders.pantryRealism) / 10; // low realism => allow niche items

  const versionBoost =
    version === "close-match" ? 0.25 : version === "balanced" ? 0.55 : 0.85;

  const raw = 10 * clamp01(0.12 + proteinFactor * 0.45 + tasteEscape * 0.25 + pantryPenalty * 0.18 + versionBoost * 0.3);
  return Math.round(raw);
}

function computeProteinEstimate(
  baseProtein: number,
  sliders: SliderValues,
  version: RecipeVersion["id"]
) {
  const proteinBoostFactor = sliders.proteinBoost / 10; // 0..1
  const realismFactor = sliders.pantryRealism / 10; // 0..1
  const tasteFactor = sliders.tasteIntegrity / 10; // 0..1

  const versionMultiplier =
    version === "close-match" ? 1.18 : version === "balanced" ? 1.35 : 1.55;

  // Realism + taste integrity slightly constrain how far we can push protein.
  const constraints = 1 - (0.12 * (1 - realismFactor) + 0.1 * (1 - tasteFactor));
  const extra = 0.65 + proteinBoostFactor * 0.9;
  const estimate = baseProtein * versionMultiplier * constraints * extra;
  return Math.max(6, round(estimate));
}

function assumptionsForDish(dish: string, category: DishCategory): string[] {
  const trimmed = dish.trim() || "the dish";
  switch (category) {
    case "mac-and-cheese":
      return [
        "Assumed classic stovetop mac and cheese (not boxed powder-only).",
        "Assumed ~2 servings for protein estimates; double ingredients for a crowd.",
      ];
    case "pancakes":
      return [
        "Assumed American-style diner pancakes (not paper-thin crepes).",
        "Assumed 4 medium pancakes per batch for protein math.",
      ];
    case "alfredo":
      return [
        "Assumed fettuccine alfredo with a cream-style sauce (not oil-only).",
        "Assumed optional add-on protein (chicken/shrimp) where noted.",
      ];
    case "burger":
      return [
        "Assumed a classic cheeseburger with bun (not lettuce-wrap unless noted).",
        "Assumed 4–6 oz patty per burger for protein estimates.",
      ];
    case "quesadilla":
      return [
        "Assumed flour-tortilla quesadilla with cheese melt (not a dry wrap).",
        "Assumed one large quesadilla cut into wedges.",
      ];
    default:
      return assumptionsForGenericDish(trimmed);
  }
}

function assumptionsForGenericDish(trimmed: string): string[] {
  const d = trimmed.toLowerCase();
  const q = `"${trimmed}"`;
  if (/(biryani|bibimbap|jollof|pilaf|congee|fried rice)/.test(d)) {
    return [
      `Assumed ${q} as a rice-centered plate (spices, proteins, and portions vary by household).`,
      "Assumed 2 hearty servings for protein estimates.",
    ];
  }
  if (/(ramen|pho|udon|laksa|soba|pad thai|dan dan)/.test(d)) {
    return [
      `Assumed ${q} as a noodle bowl with broth or sauce—not a tiny side portion.`,
      "Assumed a full bowl serving for protein math.",
    ];
  }
  if (/(curry|masala|vindaloo|korma|tikka|butter chicken|tagine|moqueca|adobo)/.test(d)) {
    return [
      `Assumed ${q} with sauce plus how you’d normally serve it (rice, bread, or noodles on the side).`,
      "Assumed moderate spice; adjust heat to your preference.",
    ];
  }
  if (/(taco|tamale|arepa|empanada|falafel|shawarma|kebab|gyro|banh mi)/.test(d)) {
    return [
      `Assumed ${q} in the usual assembled form (bread, fillings, and sauces as typically eaten).`,
      "Assumed 2–3 servings or pieces for protein estimates.",
    ];
  }
  return [`Assumed a home-cookable version of ${q}.`, "Assumed 2–4 servings."];
}

/** Keyword-based narratives when the mock uses the generic template (global cuisines, etc.). */
function genericDishNarrative(
  dish: string,
  version: RecipeVersion["id"]
): { summary: string; why: string } | null {
  const d = dish.toLowerCase();
  const t = dish.trim() || "this dish";

  const triple = (
    close: { summary: string; why: string },
    balanced: { summary: string; why: string },
    max: { summary: string; why: string }
  ) => (version === "close-match" ? close : version === "balanced" ? balanced : max);

  if (/(curry|masala|vindaloo|korma|tikka|butter chicken|tagine|moqueca|adobo)/.test(d)) {
    return triple(
      {
        summary: `Keeps ${t} recognizable: yogurt or lentil tweaks in the sauce, modest protein adds.`,
        why:
          "Blended yogurt or a scoop of lentils thickens sauce and adds protein without erasing the spice profile.",
      },
      {
        summary: `Higher-protein plate: Greek yogurt in the sauce, extra paneer/chicken/beans, still weeknight-realistic.`,
        why:
          "Dairy and legumes or extra lean meat stack grams while familiar spices carry the flavor.",
      },
      {
        summary: `Max protein: bigger protein chunks, strained yogurt base, optional protein milk where it fits.`,
        why:
          "Aggressive add-ons trade a little restaurant authenticity for a much higher protein floor.",
      }
    );
  }
  if (/(ramen|pho|udon|laksa|soba|pad thai|dan dan)/.test(d)) {
    return triple(
      {
        summary: `Same bowl vibe: slightly higher-protein noodles or a soft-tofu float—broth still tastes right.`,
        why:
          "Swapping part of the noodle block or adding silken tofu keeps slurp-and-sip satisfaction.",
      },
      {
        summary: `Extra egg, bigger protein topping, or fortified noodles—still reads as your usual noodle shop order.`,
        why:
          "Toppings and noodle swaps move protein most without rewriting the whole bowl.",
      },
      {
        summary: `Protein-forward broth helpers, double protein topping, or egg + edamame style load-out.`,
        why:
          "Layering animal or soy protein on top avoids a sad, thin broth while hitting macro goals.",
      }
    );
  }
  if (/(biryani|bibimbap|jollof|pilaf|congee|fried rice)/.test(d)) {
    return triple(
      {
        summary: `Rice still leads; a few tablespoons of lentils or extra egg keeps the plate familiar.`,
        why:
          "Tiny pulses or an extra egg blend into rice dishes without changing how you eat them.",
      },
      {
        summary: `More egg, yogurt sauce, or beans mixed through—classic rice-plate energy, higher protein.`,
        why:
          "Rice plates tolerate obvious protein adds (egg, yogurt, beans) better than saucy stews do.",
      },
      {
        summary: `Heavy on egg, yogurt, or second protein; trades a bit of fluff for a dense, filling plate.`,
        why:
          "Stacking two protein sources on rice is the fastest way to push grams without odd powders.",
      }
    );
  }
  if (/(taco|tamale|arepa|empanada|falafel|shawarma|kebab|gyro|banh mi)/.test(d)) {
    return triple(
      {
        summary: `Same handheld format: Greek yogurt crema, a bit more filling protein, shells unchanged.`,
        why:
          "Sauces and fillings move protein; bread stays familiar so it still eats like street food.",
      },
      {
        summary: `Extra meat or beans, high-protein wrap option, still foldable and messy in the right way.`,
        why:
          "Fillings and thin high-protein wraps beat weird bread substitutes for most people.",
      },
      {
        summary: `Loaded filling, double protein layer, yogurt sauces—prioritizes macros over minimalism.`,
        why:
          "Handhelds reward ‘more inside’ strategies more than delicate sauce tweaks.",
      }
    );
  }
  return null;
}

/** Richer copy for the five flagship dishes — makes the 3 versions feel distinct. */
function dishNarrative(
  dish: string,
  category: DishCategory,
  version: RecipeVersion["id"]
): { summary: string; why: string } | null {
  const n: Partial<
    Record<DishCategory, Record<RecipeVersion["id"], { summary: string; why: string }>>
  > = {
    "mac-and-cheese": {
      "close-match": {
        summary: "Still tastes like your mac: small swaps, mostly in the pasta and sauce base.",
        why:
          "High-protein pasta and blended cottage cheese add grams without changing the comfort-food vibe.",
      },
      balanced: {
        summary: "Noticeably higher protein with lentil pasta + a yogurt-smoothed sauce—still weeknight-realistic.",
        why:
          "Legume pasta and dairy you already buy bump protein while keeping a creamy, cheesy finish.",
      },
      "max-protein": {
        summary: "Pushes protein hard: thicker sauce, more cheese intensity, optional casein for serious macros.",
        why:
          "Stacking lentil pasta, concentrated dairy, and optional casein trades a bit of purity for maximum protein.",
      },
    },
    pancakes: {
      "close-match": {
        summary: "Fluffy pancakes with a light protein lift—mostly eggs, milk choice, and a touch of yogurt.",
        why:
          "Egg whites and Greek yogurt keep the batter familiar while sneaking in extra protein.",
      },
      balanced: {
        summary: "Higher-protein flour + oat flour for structure; still stacks and syrups like normal pancakes.",
        why:
          "Splitting flour keeps texture reasonable while protein milk and yogurt raise the nutrition floor.",
      },
      "max-protein": {
        summary: "Dense-but-still-pancake texture with aggressive flour and liquid swaps for macro hunters.",
        why:
          "Protein-forward flour and liquids (plus optional whey) prioritize grams over diner-style fluff.",
      },
    },
    alfredo: {
      "close-match": {
        summary: "Creamy alfredo with a cottage-cheese base—tastes closer to classic than ‘fit’ pasta.",
        why:
          "Blended cottage cheese mimics heavy cream’s body while adding protein with minimal flavor shift.",
      },
      balanced: {
        summary: "High-protein pasta + yogurt in the sauce + extra parmesan—balanced weekday upgrade.",
        why:
          "Protein pasta and parmesan stack grams; yogurt keeps the sauce tangy and smooth.",
      },
      "max-protein": {
        summary: "Maximum sauce density + lean protein in the bowl; trades some silkiness for macros.",
        why:
          "Extra chicken/turkey and optional whey in the sauce push protein while bold seasoning covers dairy notes.",
      },
    },
    burger: {
      "close-match": {
        summary: "Same burger night: yogurt-mustard sauce and a modest cheese bump—minimal vibe change.",
        why:
          "Swapping condiments to yogurt-based sauce adds protein without turning it into a ‘healthy’ burger cliché.",
      },
      balanced: {
        summary: "Leaner patty or turkey + protein bun option; still reads as a real burger.",
        why:
          "Lean meat and higher-protein bread move the macro needle while keeping toppings you’d actually use.",
      },
      "max-protein": {
        summary: "Extra egg binder, stacked cheese, optional cottage cheese—big protein, still handheld.",
        why:
          "Multiple dairy/protein layers and lean meat maximize grams; lettuce wrap avoids a soggy protein bun.",
      },
    },
    quesadilla: {
      "close-match": {
        summary: "Classic melt with a little extra chicken or beans—barely changes the eating experience.",
        why:
          "A modest protein filling inside the cheese keeps the quesadilla crispy-chewy and familiar.",
      },
      balanced: {
        summary: "Protein tortillas + Greek yogurt crema—big gain, still taco-night easy.",
        why:
          "Higher-protein wraps and yogurt swap sour cream for tang with more protein per bite.",
      },
      "max-protein": {
        summary: "Loaded filling: extra meat + beans + cheese volume; sacrifices some crisp for protein.",
        why:
          "Stacking animal and plant protein with extra cheese makes the wedge heavy in the best way.",
      },
    },
  };
  const specific = n[category]?.[version];
  if (specific) return specific;
  if (category === "generic") return genericDishNarrative(dish, version);
  return null;
}

function versionScores(sliders: SliderValues, version: RecipeVersion["id"]) {
  const tasteBase = scoreFromSlider(sliders.tasteIntegrity);
  const realismBase = scoreFromSlider(sliders.pantryRealism);

  const tasteScore =
    version === "close-match"
      ? Math.round(0.9 * tasteBase + 0.4)
      : version === "balanced"
        ? Math.round(0.75 * tasteBase + 1.2)
        : Math.round(0.6 * tasteBase + 1.6);

  const realismScore =
    version === "close-match"
      ? Math.round(0.95 * realismBase + 0.2)
      : version === "balanced"
        ? Math.round(0.82 * realismBase + 0.8)
        : Math.round(0.7 * realismBase + 0.6);

  const aggressivenessScore = computeAggressiveness(sliders, version);

  return {
    tasteScore: Math.max(0, Math.min(10, tasteScore)),
    realismScore: Math.max(0, Math.min(10, realismScore)),
    aggressivenessScore: Math.max(0, Math.min(10, aggressivenessScore)),
  };
}

function applyOverrides(
  ingredients: Ingredient[],
  overrides: IngredientOverride[]
): Ingredient[] {
  if (!overrides.length) return ingredients;
  const byId = new Map<string, string>();
  for (const o of overrides) byId.set(o.ingredientId, o.forceReplacement);

  return ingredients.map((ing) => {
    const forced = byId.get(ing.id);
    if (!forced) return ing;
    return {
      ...ing,
      current: forced,
      reason: `User-selected swap for ${ing.id}. Tradeoff follows the selected option.`,
    };
  });
}

function applyTransformationModeDefaults(
  ingredients: Ingredient[],
  mode: TransformationMode | undefined
): Ingredient[] {
  if (!mode || mode === "proteinify") return ingredients;

  return ingredients.map((ing) => {
    if (!ing.swapOptions?.length) return ing;

    const chosen =
      ing.swapOptions.find((o) => o.type === "more-authentic")?.replacement ??
      ing.swapOptions.find((o) => o.type === "simpler")?.replacement ??
      ing.swapOptions.find((o) => o.type === "more-common")?.replacement ??
      null;

    if (!chosen) return ing;
    if (chosen === ing.current) return ing;

    return {
      ...ing,
      current: chosen,
      reason: `${ing.reason} (Lean-mode tradeoff.)`,
    };
  });
}

function mockVeggieAddition(dish: string, category: DishCategory, version: RecipeVersion["id"]): Ingredient {
  const d = dish.toLowerCase();
  const ricey = /(biryani|fried rice|jambalaya|paella|risotto|rice bowl|bibimbap|congee|pulao|dirty rice)/.test(d);
  const creamy =
    category === "mac-and-cheese" ||
    category === "alfredo" ||
    /alfredo|carbonara|creamy|mac and cheese|fettuccine/.test(d);

  if (ricey) {
    return {
      id: `ing-veggie-${version}`,
      original: "(new addition)",
      current: "green peas, folded in off heat",
      amount: "½ cup",
      reason:
        "Peas read like a natural rice finish—tiny sweet pops that fold into the grain without rewriting the dish.",
      swapOptions: [
        {
          type: "more-authentic",
          label: "Omit the peas",
          replacement: "omit pea addition",
          effect: "closest to the baseline rice build",
        },
        {
          type: "simpler",
          label: "Use frozen peas",
          replacement: "frozen petite peas",
          effect: "same idea, less prep",
        },
        {
          type: "higher-protein",
          label: "Snap peas instead",
          replacement: "sliced snap peas",
          effect: "more crunch, slight flavor shift",
        },
        {
          type: "cheaper",
          label: "Shredded cabbage",
          replacement: "finely shredded green cabbage",
          effect: "budget-friendly bulk without fighting the spice layer",
        },
      ],
    };
  }

  if (creamy) {
    return {
      id: `ing-veggie-${version}`,
      original: "(new addition)",
      current: "baby spinach, wilted in at the end",
      amount: "1 big handful",
      reason:
        "Spinach collapses into the creamy base the way a sauced green would in a restaurant kitchen—earthy, but it disappears into the cheese line.",
      swapOptions: [
        {
          type: "more-authentic",
          label: "Skip the greens",
          replacement: "omit spinach addition",
          effect: "keeps the original sauce color and texture",
        },
        {
          type: "simpler",
          label: "Use frozen spinach",
          replacement: "thawed frozen spinach, squeezed dry",
          effect: "same direction, quicker",
        },
        {
          type: "higher-protein",
          label: "Add chopped broccoli",
          replacement: "finely chopped broccoli florets",
          effect: "more bite, slight vegetal note",
        },
        {
          type: "more-common",
          label: "Mushrooms instead",
          replacement: "sliced cremini mushrooms, sautéed",
          effect: "deeper savoriness, less green flavor",
        },
      ],
    };
  }

  return {
    id: `ing-veggie-${version}`,
    original: "(new addition)",
    current: "baby spinach, wilted in at the end",
    amount: "1 handful",
    reason:
      "A last-minute wilted green reads like a chef's finish—it rounds the plate without announcing itself as a separate side.",
    swapOptions: [
      {
        type: "more-authentic",
        label: "Omit greens",
        replacement: "omit spinach addition",
        effect: "stays closer to the classic build",
      },
      {
        type: "simpler",
        label: "Use frozen spinach",
        replacement: "thawed frozen spinach, squeezed dry",
        effect: "faster pantry path",
      },
      {
        type: "higher-protein",
        label: "Quick broccolini",
        replacement: "blanched broccolini, chopped",
        effect: "more texture, slight bitter balance",
      },
      {
        type: "cheaper",
        label: "Shredded cabbage",
        replacement: "fine-shred green cabbage",
        effect: "lighter cost, still eats like a mixed-in veg",
      },
    ],
  };
}

function withMockVeggieAdditions(
  ingredients: Ingredient[],
  addVeggies: boolean | undefined,
  dish: string,
  category: DishCategory,
  version: RecipeVersion["id"]
): Ingredient[] {
  if (!addVeggies) return ingredients;
  return [...ingredients, mockVeggieAddition(dish, category, version)];
}

function dishTemplates(category: DishCategory) {
  const commonStepPrefix = (v: RecipeVersion["id"]) =>
    v === "max-protein"
      ? "Cook with a focus on protein-rich ingredients."
      : v === "balanced"
        ? "Cook as you normally would, then finish with protein-focused tweaks."
        : "Keep the familiar process, with small protein upgrades.";

  /** Concat-only steps avoid nested template literals (some bundlers misparse them in large literals). */
  const step = (v: RecipeVersion["id"], tail: string) => commonStepPrefix(v) + " " + tail;

  const templates: Record<
    DishCategory,
    {
      versions: Omit<
        RecipeVersion,
        | "id"
        | "label"
        | "macros"
        | "tasteScore"
        | "realismScore"
        | "aggressivenessScore"
        | "adds"
        | "transformationByComponent"
        | "methodAdjustments"
        | "cookTimeMinutes"
        | "difficulty"
      > & {
        versionsById: Partial<Record<RecipeVersion["id"], { ingredientsById: (ingredientId: string) => string; steps: RecipeStep[] }>>;
      };
    }
  > = {
    "mac-and-cheese": {
      versions: {
        summary: "",
        why: "",
        ingredients: [],
        steps: [],
        versionsById: {
          "close-match": {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "high-protein pasta";
              if (ingredientId === "ing-2") return "low-fat cottage cheese (blended smooth)";
              if (ingredientId === "ing-3") return "sharp cheddar + extra cheese powder";
              if (ingredientId === "ing-4") return "skim milk (or high-protein milk)";
              return "—";
            },
            steps: [
              "Salt your pasta water; boil until just shy of al dente (it finishes in the sauce).",
              "Blend cottage cheese with a splash of milk until completely smooth—no lumps.",
              "Warm cheddar into the blended base on low heat until glossy; thin only if needed.",
              "Fold in pasta, finish 1–2 minutes on low, then season (salt, pepper, tiny pinch of mustard powder optional).",
            ],
          },
          balanced: {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "lentil pasta";
              if (ingredientId === "ing-2") return "cottage cheese + a splash of Greek yogurt";
              if (ingredientId === "ing-3") return "cheddar + parmesan (increased)";
              if (ingredientId === "ing-4") return "high-protein milk";
              return "—";
            },
            steps: [
              "Cook lentil pasta firmly al dente; drain, toss with a teaspoon of oil to prevent clumping.",
              "Puree cottage cheese + yogurt with seasonings until silky.",
              "Simmer cheddar + parmesan into the base until thick enough to coat a spoon.",
              "Toss pasta and sauce; add splashes of protein milk to adjust texture, then serve hot.",
            ],
          },
          "max-protein": {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "lentil pasta (plus extra protein add-in)";
              if (ingredientId === "ing-2") return "high-protein ricotta (or cottage cheese + extra whey)";
              if (ingredientId === "ing-3") return "cheddar + parmesan + powdered casein (optional)";
              if (ingredientId === "ing-4") return "high-protein milk";
              return "—";
            },
            steps: [
              "Undercook lentil pasta slightly; reserve 1/2 cup pasta water.",
              "Blend ricotta/cottage cheese until ultra-smooth; whisk in optional casein off heat to avoid grit.",
              "Build a tight sauce with cheeses + splash of pasta water; it should cling heavily.",
              "Combine with pasta, finish aggressively seasoned; eat immediately—max-protein sauces set fast.",
            ],
          },
        },
      },
    },
    pancakes: {
      versions: {
        summary: "",
        why: "",
        ingredients: [],
        steps: [],
        versionsById: {
          "close-match": {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "regular flour (or half high-protein flour)";
              if (ingredientId === "ing-2") return "egg + egg whites";
              if (ingredientId === "ing-3") return "whole milk or protein milk";
              if (ingredientId === "ing-4") return "Greek yogurt instead of part of the milk";
              return "—";
            },
            steps: [
              "Whisk dry flour, baking powder, and a pinch of salt in one bowl.",
              "Whisk wet: eggs, milk, and yogurt until smooth; combine until *just* mixed (lumps are OK).",
              "Rest batter 5 minutes while the griddle heats (medium-low).",
              "Pour 1/4 cup rounds; flip when bubbles burst and edges look dry—don’t press down.",
            ],
          },
          balanced: {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "half oat flour + half high-protein flour";
              if (ingredientId === "ing-2") return "egg whites + 1 whole egg";
              if (ingredientId === "ing-3") return "protein milk";
              if (ingredientId === "ing-4") return "Greek yogurt in the batter";
              return "—";
            },
            steps: [
              "Sift oat + protein flour with leavening to avoid dense spots.",
              "Beat wet ingredients until foamy; fold into dry until barely combined.",
              "Use a hot, lightly oiled griddle; lower heat if they brown before centers set.",
              "Stack and serve with butter + syrup—texture should still feel like pancakes, not hockey pucks.",
            ],
          },
          "max-protein": {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "all high-protein pancake mix or protein flour";
              if (ingredientId === "ing-2") return "extra egg whites";
              if (ingredientId === "ing-3") return "high-protein milk";
              if (ingredientId === "ing-4") return "Greek yogurt + optional whey in batter";
              return "—";
            },
            steps: [
              "Mix dry protein flour with extra leavening if your mix is lean on rise.",
              "Blend yogurt + milk + egg whites; add optional whey last to limit clumping.",
              "Cook smaller silver-dollar cakes so centers cook through without burning outsides.",
              "Eat hot—high-protein batters firm up as they cool.",
            ],
          },
        },
      },
    },
    alfredo: {
      versions: {
        summary: "",
        why: "",
        ingredients: [],
        steps: [],
        versionsById: {
          "close-match": {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "regular pasta";
              if (ingredientId === "ing-2") return "alfredo sauce with cottage cheese blended";
              if (ingredientId === "ing-3") return "parmesan (normal amount)";
              if (ingredientId === "ing-4") return "chicken or turkey (small add-on)";
              return "—";
            },
            steps: [
              "Boil pasta in salted water to al dente; reserve 1 cup pasta water.",
              "Blend cottage cheese with garlic, nutmeg, and black pepper until completely smooth.",
              "Warm the blended base gently; whisk in parmesan until it melts into a sauce (thin with pasta water).",
              "Toss pasta with sauce; add sliced pre-cooked chicken on top if using—keep it simple.",
            ],
          },
          balanced: {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "high-protein pasta";
              if (ingredientId === "ing-2") return "cottage cheese + Greek yogurt alfredo base";
              if (ingredientId === "ing-3") return "parmesan (increased)";
              if (ingredientId === "ing-4") return "chicken (or shrimp) in the sauce";
              return "—";
            },
            steps: [
              "Cook high-protein pasta al dente; toss with a little oil if it sits.",
              "Puree cottage cheese + yogurt with seasonings; simmer until it thickens slightly.",
              "Sauté chicken or shrimp, then finish cooking in the sauce so juices season it.",
              "Toss pasta, adjust salt, and shower with extra parmesan.",
            ],
          },
          "max-protein": {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "high-protein pasta or lentil pasta";
              if (ingredientId === "ing-2") return "very thick cottage-cheese base (blended)";
              if (ingredientId === "ing-3") return "parmesan + optional protein powder";
              if (ingredientId === "ing-4") return "extra chicken or turkey (larger amount)";
              return "—";
            },
            steps: [
              "Undercook lentil or protein pasta by 1 minute; it will tighten in the thick sauce.",
              "Blend cottage cheese until thick and sticky; add parmesan in batches off heat.",
              "Fold in extra diced chicken; if using whey/casein, whisk in off heat and taste often.",
              "Toss fast—max-protein sauces seize quickly; add pasta water to rescue.",
            ],
          },
        },
      },
    },
    burger: {
      versions: {
        summary: "",
        why: "",
        ingredients: [],
        steps: [],
        versionsById: {
          "close-match": {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "80/20 ground beef";
              if (ingredientId === "ing-2") return "Greek yogurt burger sauce";
              if (ingredientId === "ing-3") return "cheddar";
              if (ingredientId === "ing-4") return "regular bun";
              return "—";
            },
            steps: [
              "Gently mix salt/pepper into beef; form loose 4–6 oz patties (don’t overwork).",
              "Hot skillet or grill: sear first side hard, flip once, add cheese near the end to melt.",
              "Stir yogurt + mustard + pickle brine for a quick ‘special sauce’.",
              "Toast bun lightly; stack lettuce/tomato/pickle so the bottom bun doesn’t sog out.",
            ],
          },
          balanced: {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "leaner ground beef (or turkey)";
              if (ingredientId === "ing-2") return "yogurt + mustard sauce";
              if (ingredientId === "ing-3") return "cheddar + extra cheese slice";
              if (ingredientId === "ing-4") return "high-protein burger buns";
              return "—";
            },
            steps: [
              "For turkey/lean beef, add a touch more salt and make a slight dimple in the patty center.",
              "Cook through but not dry—pull at 160°F / 165°F for poultry; rest 2–3 minutes.",
              "Double cheese: add the second slice after the flip so it melts evenly.",
              "Toast protein buns lightly—they brown faster than regular buns.",
            ],
          },
          "max-protein": {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "extra-lean beef or turkey + egg binder";
              if (ingredientId === "ing-2") return "yogurt sauce + grated parmesan";
              if (ingredientId === "ing-3") return "cheese + cottage cheese dollops";
              if (ingredientId === "ing-4") return "protein bun or lettuce wrap option";
              return "—";
            },
            steps: [
              "Mix lean meat with egg + salt/pepper; form thinner patties for even cooking.",
              "Cook in a ripping-hot pan for crust; finish with cottage cheese + parmesan under a lid to melt.",
              "If using lettuce wrap, patty must be extra firm—rest before wrapping.",
              "Eat immediately—max-protein stacks cool into a solid tower fast.",
            ],
          },
        },
      },
    },
    quesadilla: {
      versions: {
        summary: "",
        why: "",
        ingredients: [],
        steps: [],
        versionsById: {
          "close-match": {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "flour tortillas";
              if (ingredientId === "ing-2") return "shredded cheese (normal amount)";
              if (ingredientId === "ing-3") return "chicken or beans (small add-on)";
              if (ingredientId === "ing-4") return "salsa + sour cream";
              return "—";
            },
            steps: [
              "Spread cheese on half the tortilla; add a thin layer of chicken or beans (don’t overload).",
              "Fold closed; press gently—medium heat in an oiled skillet.",
              "2–3 minutes per side until golden spots appear and cheese flows at the edge.",
              "Cut into wedges; sour cream + salsa on the side (classic quesadilla rhythm).",
            ],
          },
          balanced: {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "high-protein tortillas";
              if (ingredientId === "ing-2") return "cheese + a bit of cottage cheese for melt";
              if (ingredientId === "ing-3") return "chicken (larger portion) or tofu crumbles";
              if (ingredientId === "ing-4") return "salsa + Greek yogurt instead of sour cream";
              return "—";
            },
            steps: [
              "Mix shredded cheese with cottage cheese so it melts without separating.",
              "Layer protein + cheese, fold, and cook covered briefly to steam the filling.",
              "Uncover to crisp both sides—watch protein tortillas; they brown faster.",
              "Finish with yogurt + salsa as a crema (thin yogurt with lime juice if needed).",
            ],
          },
          "max-protein": {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "high-protein tortillas or thin wraps";
              if (ingredientId === "ing-2") return "cheese + extra cottage cheese";
              if (ingredientId === "ing-3") return "extra chicken + beans";
              if (ingredientId === "ing-4") return "Greek yogurt crema";
              return "—";
            },
            steps: [
              "Build a thick filling: beans + chicken + cheese + cottage cheese (press out excess moisture first).",
              "Use medium-low heat and a longer cook so the center heats through without burning the shell.",
              "Flip once when the bottom is crisp; press gently with a spatula.",
              "Rest 1 minute before cutting so the cheese doesn’t squirt out.",
            ],
          },
        },
      },
    },
    "ice-cream": {
      versions: {
        summary: "",
        why: "",
        ingredients: [],
        steps: [],
        versionsById: {
          "close-match": {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "milk or half-and-half";
              if (ingredientId === "ing-2") return "Greek yogurt (milder swap)";
              if (ingredientId === "ing-3") return "a little protein-friendly sweetener";
              if (ingredientId === "ing-4") return "vanilla + cocoa (to taste)";
              return "—";
            },
            steps: [
              step("close-match", "Keep it creamy by blending yogurt smoothly."),
              "Warm milk, whisk in flavorings, then cool.",
              "Churn or freeze with periodic stirring until scoopable.",
              "Serve with toppings you already like.",
            ],
          },
          balanced: {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "protein milk blend";
              if (ingredientId === "ing-2") return "Greek yogurt base (thicker)";
              if (ingredientId === "ing-3") return "whey or milk powder (small)";
              if (ingredientId === "ing-4") return "vanilla + cocoa or fruit puree";
              return "—";
            },
            steps: [
              step("balanced", "Use a thicker dairy base for texture."),
              "Blend yogurt with protein milk and flavor.",
              "Cool fully, then churn/freeze until set.",
              "Taste and adjust sweetness for familiar flavor.",
            ],
          },
          "max-protein": {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "high-protein milk + yogurt mix";
              if (ingredientId === "ing-2") return "extra Greek yogurt";
              if (ingredientId === "ing-3") return "whey protein (for body + protein)";
              if (ingredientId === "ing-4") return "strong vanilla/cocoa flavor to mask bitterness";
              return "—";
            },
            steps: [
              step("max-protein", "For max protein, flavor needs to do the heavy lifting."),
              "Blend yogurt with protein milk and flavor.",
              "Whisk in whey (small amount) and cool thoroughly.",
              "Freeze until scoopable; serve quickly for best texture.",
            ],
          },
        },
      },
    },
    pizza: {
      versions: {
        summary: "",
        why: "",
        ingredients: [],
        steps: [],
        versionsById: {
          "close-match": {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "regular pizza dough";
              if (ingredientId === "ing-2") return "cheese (normal amount)";
              if (ingredientId === "ing-3") return "pepperoni or chicken (small add-on)";
              if (ingredientId === "ing-4") return "pizza sauce + seasonings";
              return "—";
            },
            steps: [
              step("close-match", "Preheat oven and prep dough as usual."),
              "Spread sauce, then a familiar layer of cheese.",
              "Add a modest protein topping (pepperoni or chicken).",
              "Bake until bubbly and crisp at the edges.",
            ],
          },
          balanced: {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "protein pizza crust (or swap flour)";
              if (ingredientId === "ing-2") return "more mozzarella + cottage cheese dots";
              if (ingredientId === "ing-3") return "chicken or turkey + lean sausage";
              if (ingredientId === "ing-4") return "pizza sauce + herbs (keep simple)";
              return "—";
            },
            steps: [
              step("balanced", "Use a protein-forward crust without overcomplicating it."),
              "Layer sauce and cheese; add cottage cheese for melt.",
              "Top with lean meat for protein.",
              "Bake and slice; keep the toppings you’d normally buy.",
            ],
          },
          "max-protein": {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "protein crust + extra egg/cheese binder";
              if (ingredientId === "ing-2") return "lots of mozzarella + parmesan";
              if (ingredientId === "ing-3") return "extra chicken/lean meat + beans (optional)";
              if (ingredientId === "ing-4") return "simple sauce with added parmesan";
              return "—";
            },
            steps: [
              step("max-protein", "Load the protein toppings while keeping bake times consistent."),
              "Use a thicker, protein-rich crust so it doesn’t get watery.",
              "Add heavier cheese and extra lean meat.",
              "Bake until crisp; rest 2 minutes before cutting.",
            ],
          },
        },
      },
    },
    "chicken-tenders": {
      versions: {
        summary: "",
        why: "",
        ingredients: [],
        steps: [],
        versionsById: {
          "close-match": {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "chicken tenders";
              if (ingredientId === "ing-2") return "regular breadcrumbs";
              if (ingredientId === "ing-3") return "egg wash";
              if (ingredientId === "ing-4") return "basic dipping sauce";
              return "—";
            },
            steps: [
              step("close-match", "Pat chicken dry and season."),
              "Dredge in egg wash, then breadcrumbs.",
              "Pan-fry or bake until crisp and cooked through.",
              "Serve with your usual dip.",
            ],
          },
          balanced: {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "chicken tenders (or chicken breast strips)";
              if (ingredientId === "ing-2") return "high-protein breadcrumbs (or add parmesan)";
              if (ingredientId === "ing-3") return "egg wash + Greek yogurt marinade";
              if (ingredientId === "ing-4") return "Greek yogurt dip";
              return "—";
            },
            steps: [
              step("balanced", "Marinate briefly in yogurt for tenderness."),
              "Use protein-friendly crumbs (parmesan helps).",
              "Bake or air-fry for less mess.",
              "Serve with a yogurt-based dip for extra protein.",
            ],
          },
          "max-protein": {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "extra-lean chicken (or mix with extra whites)";
              if (ingredientId === "ing-2") return "protein crumb coating + parmesan";
              if (ingredientId === "ing-3") return "egg wash + extra yogurt";
              if (ingredientId === "ing-4") return "high-protein dip (yogurt + seasoning)";
              return "—";
            },
            steps: [
              step("max-protein", "Build a thick coating that still browns."),
              "Marinate with yogurt; then coat with protein crumbs.",
              "Bake/air-fry until crisp and hot inside.",
              "Serve immediately for maximum crunch.",
            ],
          },
        },
      },
    },
    generic: {
      versions: {
        summary: "",
        why: "",
        ingredients: [],
        steps: [],
        versionsById: {
          "close-match": {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "familiar base (small protein swap)";
              if (ingredientId === "ing-2") return "cottage cheese or Greek yogurt blended into sauce";
              if (ingredientId === "ing-3") return "cheese or legumes (moderate protein add)";
              if (ingredientId === "ing-4") return "simple liquid (milk/broth) adjusted for texture";
              return "—";
            },
            steps: [
              step("close-match", "Make the dish as you normally would, then add small protein swaps."),
              "Blend dairy/yogurt for creaminess.",
              "Simmer and season for the right taste balance.",
              "Serve with familiar sides.",
            ],
          },
          balanced: {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "higher-protein staple (pasta/rice substitute)";
              if (ingredientId === "ing-2") return "Greek yogurt base for sauce";
              if (ingredientId === "ing-3") return "chicken/beans to increase protein";
              if (ingredientId === "ing-4") return "protein-friendly liquid (milk/broth)";
              return "—";
            },
            steps: [
              step("balanced", "Use a straightforward recipe with protein swaps that fit normal cooking."),
              "Choose one staple swap and one protein add-on.",
              "Adjust seasoning and simmer until cohesive.",
              "Taste and tweak to keep it close to the original.",
            ],
          },
          "max-protein": {
            ingredientsById: (ingredientId) => {
              if (ingredientId === "ing-1") return "lentil/high-protein staple";
              if (ingredientId === "ing-2") return "high-protein dairy base";
              if (ingredientId === "ing-3") return "bigger protein add-on (chicken/beans)";
              if (ingredientId === "ing-4") return "thicker sauce/liquid for hold";
              return "—";
            },
            steps: [
              step("max-protein", "Apply stronger protein swaps while keeping the dish recognizable."),
              "Use more aggressive protein add-ons and thicker sauces.",
              "Season boldly to prevent any protein-y aftertaste.",
              "Serve immediately for best texture.",
            ],
          },
        },
      },
    },
  };

  // Base ingredient list (originals) + per-category amounts.
  const baseIngredientsByCategory: Record<DishCategory, Ingredient[]> = {
    "mac-and-cheese": [
      {
        id: "ing-1",
        original: "regular pasta",
        current: "—",
        amount: "8 oz",
        reason: "Baseline carb sets the comfort-food feel.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Keep regular pasta",
            replacement: "regular pasta",
            effect: "better texture, less protein",
          },
          {
            type: "higher-protein",
            label: "Use high-protein pasta",
            replacement: "high-protein pasta",
            effect: "more protein, small taste change",
          },
          {
            type: "more-common",
            label: "Use lentil pasta",
            replacement: "lentil pasta",
            effect: "more protein, somewhat bolder flavor",
          },
        ],
      },
      {
        id: "ing-2",
        original: "cream/milk-based sauce",
        current: "—",
        amount: "1.5-2 cups",
        reason: "Blending dairy keeps it creamy without preaching.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Use cream as usual",
            replacement: "cream",
            effect: "closest mouthfeel, less protein",
          },
          {
            type: "higher-protein",
            label: "Blend cottage cheese",
            replacement: "low-fat cottage cheese (blended smooth)",
            effect: "more protein, mild taste shift",
          },
          {
            type: "more-common",
            label: "Use Greek yogurt (blended)",
            replacement: "Greek yogurt (blended smooth)",
            effect: "more protein, familiar tang",
          },
        ],
      },
      {
        id: "ing-3",
        original: "cheddar",
        current: "—",
        amount: "1 cup",
        reason: "More cheese increases protein and thickens.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Use cheddar only",
            replacement: "cheddar",
            effect: "classic flavor, less protein",
          },
          {
            type: "higher-protein",
            label: "Add parmesan",
            replacement: "cheddar + parmesan",
            effect: "more protein, slightly sharper taste",
          },
          {
            type: "cheaper",
            label: "Add extra shredded cheese blend",
            replacement: "shredded cheese blend",
            effect: "more protein, variable taste",
          },
        ],
      },
      {
        id: "ing-4",
        original: "whole milk",
        current: "—",
        amount: "1/2 cup",
        reason: "Milk choice affects texture and protein modestly.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Use whole milk",
            replacement: "whole milk",
            effect: "closest flavor, less protein",
          },
          {
            type: "higher-protein",
            label: "Use high-protein milk",
            replacement: "high-protein milk",
            effect: "more protein, similar taste",
          },
          {
            type: "more-common",
            label: "Use skim milk",
            replacement: "skim milk",
            effect: "lighter, easier to find",
          },
        ],
      },
    ],
    pancakes: [
      {
        id: "ing-1",
        original: "regular flour",
        current: "—",
        amount: "1 cup",
        reason: "Flour type controls texture more than flavor.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Keep regular flour",
            replacement: "regular flour",
            effect: "closest taste, less protein",
          },
          {
            type: "higher-protein",
            label: "Use protein flour (or half/half)",
            replacement: "high-protein flour",
            effect: "more protein, texture slightly denser",
          },
          {
            type: "more-common",
            label: "Use oat flour",
            replacement: "oat flour",
            effect: "more fiber and protein, familiar flavor",
          },
        ],
      },
      {
        id: "ing-2",
        original: "whole eggs",
        current: "—",
        amount: "2 eggs",
        reason: "Egg whites increase protein without changing pancake shape.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Use 2 whole eggs",
            replacement: "2 whole eggs",
            effect: "classic taste, less protein",
          },
          {
            type: "higher-protein",
            label: "Add egg whites",
            replacement: "1 whole egg + 1/2 cup egg whites",
            effect: "more protein, slightly lighter crumb",
          },
          {
            type: "simpler",
            label: "Add an extra egg",
            replacement: "3 whole eggs",
            effect: "more protein, no special ingredients",
          },
        ],
      },
      {
        id: "ing-3",
        original: "milk",
        current: "—",
        amount: "3/4 cup",
        reason: "Protein milk boosts protein while staying liquid.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Use regular milk",
            replacement: "whole milk",
            effect: "classic flavor",
          },
          {
            type: "higher-protein",
            label: "Use protein milk",
            replacement: "protein milk",
            effect: "more protein, mild taste change",
          },
          {
            type: "more-common",
            label: "Use skim milk",
            replacement: "skim milk",
            effect: "lighter taste, easier to find",
          },
        ],
      },
      {
        id: "ing-4",
        original: "no yogurt",
        current: "—",
        amount: "1/2 cup",
        reason: "Yogurt gives lift and creaminess without preaching.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Skip yogurt",
            replacement: "no yogurt",
            effect: "closest taste, less protein",
          },
          {
            type: "higher-protein",
            label: "Use Greek yogurt",
            replacement: "Greek yogurt",
            effect: "more protein, slightly tangy",
          },
          {
            type: "simpler",
            label: "Use sour cream (small swap)",
            replacement: "sour cream",
            effect: "easy swap, moderate boost",
          },
        ],
      },
    ],
    alfredo: [
      {
        id: "ing-1",
        original: "regular pasta",
        current: "—",
        amount: "10 oz",
        reason: "Pasta choice is the simplest control surface.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Keep regular pasta",
            replacement: "regular pasta",
            effect: "closest mouthfeel, less protein",
          },
          {
            type: "higher-protein",
            label: "Use high-protein pasta",
            replacement: "high-protein pasta",
            effect: "more protein, small taste change",
          },
          {
            type: "more-common",
            label: "Use lentil pasta",
            replacement: "lentil pasta",
            effect: "more protein, bolder flavor",
          },
        ],
      },
      {
        id: "ing-2",
        original: "cream-based sauce",
        current: "—",
        amount: "2 cups",
        reason: "Blended cottage cheese keeps it creamy.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Use cream as usual",
            replacement: "cream",
            effect: "closest flavor, less protein",
          },
          {
            type: "higher-protein",
            label: "Blend cottage cheese",
            replacement: "cottage cheese (blended)",
            effect: "more protein, texture stays creamy",
          },
          {
            type: "more-common",
            label: "Use Greek yogurt (blended)",
            replacement: "Greek yogurt (blended)",
            effect: "more protein, familiar tang",
          },
        ],
      },
      {
        id: "ing-3",
        original: "parmesan",
        current: "—",
        amount: "1/2 cup",
        reason: "More parmesan thickens and boosts protein.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Keep parmesan normal",
            replacement: "parmesan",
            effect: "classic taste",
          },
          {
            type: "higher-protein",
            label: "Add more parmesan",
            replacement: "parmesan (increased)",
            effect: "more protein, sharper flavor",
          },
          {
            type: "cheaper",
            label: "Use a cheese blend",
            replacement: "cheese blend",
            effect: "cheaper, variable taste",
          },
        ],
      },
      {
        id: "ing-4",
        original: "no added protein",
        current: "—",
        amount: "optional",
        reason: "Adding a protein component is the most direct lever.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Skip protein add-on",
            replacement: "no added protein",
            effect: "closest to original alfredo",
          },
          {
            type: "higher-protein",
            label: "Add chicken",
            replacement: "chicken",
            effect: "more protein, more filling",
          },
          {
            type: "vegetarian",
            label: "Add tofu or beans",
            replacement: "tofu or beans",
            effect: "vegetarian, different texture",
          },
        ],
      },
    ],
    burger: [
      {
        id: "ing-1",
        original: "80/20 ground beef",
        current: "—",
        amount: "1 lb",
        reason: "Meat choice impacts both protein and bite.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Keep 80/20 beef",
            replacement: "80/20 ground beef",
            effect: "best classic beefy taste, less protein",
          },
          {
            type: "higher-protein",
            label: "Use leaner beef or turkey",
            replacement: "lean ground beef or turkey",
            effect: "more protein, slightly drier bite",
          },
          {
            type: "cheaper",
            label: "Use store-brand lean beef",
            replacement: "store-brand lean beef",
            effect: "similar taste, good value",
          },
        ],
      },
      {
        id: "ing-2",
        original: "mayo-based sauce",
        current: "—",
        amount: "1/4 cup",
        reason: "Yogurt sauce keeps burger vibe without huge changes.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Use mayo as usual",
            replacement: "mayo",
            effect: "classic taste, less protein",
          },
          {
            type: "higher-protein",
            label: "Use Greek yogurt sauce",
            replacement: "Greek yogurt burger sauce",
            effect: "more protein, tangy but familiar",
          },
          {
            type: "simpler",
            label: "Use mustard + yogurt",
            replacement: "yogurt + mustard",
            effect: "easy, protein up",
          },
        ],
      },
      {
        id: "ing-3",
        original: "cheddar",
        current: "—",
        amount: "2 slices",
        reason: "Cheese increases protein while staying delicious.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Use cheddar only",
            replacement: "cheddar",
            effect: "classic taste, smaller protein gain",
          },
          {
            type: "higher-protein",
            label: "Add parmesan",
            replacement: "cheddar + parmesan",
            effect: "more protein, sharper flavor",
          },
          {
            type: "more-common",
            label: "Add extra cheddar",
            replacement: "extra cheddar",
            effect: "more protein, minimal tradeoff",
          },
        ],
      },
      {
        id: "ing-4",
        original: "regular bun",
        current: "—",
        amount: "1 bun",
        reason: "Buns affect the last bit of realism and protein.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Use regular bun",
            replacement: "regular bun",
            effect: "closest feel, less protein",
          },
          {
            type: "more-common",
            label: "Use high-protein bun",
            replacement: "high-protein burger buns",
            effect: "more protein, still common",
          },
          {
            type: "simpler",
            label: "Use lettuce wrap",
            replacement: "lettuce wrap",
            effect: "lower carbs, less bun taste",
          },
        ],
      },
    ],
    quesadilla: [
      {
        id: "ing-1",
        original: "flour tortillas",
        current: "—",
        amount: "2 tortillas",
        reason: "Tortilla choice is a quick protein lever.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Keep flour tortillas",
            replacement: "flour tortillas",
            effect: "closest taste",
          },
          {
            type: "higher-protein",
            label: "Use high-protein tortillas",
            replacement: "high-protein tortillas",
            effect: "more protein, mild flavor shift",
          },
          {
            type: "more-common",
            label: "Use thin wraps",
            replacement: "thin wraps",
            effect: "easier to find, moderate gain",
          },
        ],
      },
      {
        id: "ing-2",
        original: "shredded cheese",
        current: "—",
        amount: "1 cup",
        reason: "Cheese drives melt and protein.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Keep regular cheese",
            replacement: "shredded cheese",
            effect: "classic melt, less protein",
          },
          {
            type: "higher-protein",
            label: "Add cottage cheese for melt",
            replacement: "cheese + cottage cheese",
            effect: "more protein, still gooey",
          },
          {
            type: "more-common",
            label: "Use cheese blend",
            replacement: "cheese blend",
            effect: "common, consistent melt",
          },
        ],
      },
      {
        id: "ing-3",
        original: "no protein filling",
        current: "—",
        amount: "1/2-1 cup",
        reason: "Protein filling is the main boost lever.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Keep it simple",
            replacement: "beans or small chicken portion",
            effect: "closest vibe, smaller gain",
          },
          {
            type: "higher-protein",
            label: "Use more chicken",
            replacement: "extra chicken",
            effect: "more protein, heartier bite",
          },
          {
            type: "vegetarian",
            label: "Use tofu crumbles",
            replacement: "tofu crumbles",
            effect: "vegetarian, different chew",
          },
        ],
      },
      {
        id: "ing-4",
        original: "sour cream",
        current: "—",
        amount: "2-3 tbsp",
        reason: "Crema is an easy place for protein-friendly tang.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Use sour cream",
            replacement: "sour cream",
            effect: "classic flavor, less protein",
          },
          {
            type: "higher-protein",
            label: "Use Greek yogurt crema",
            replacement: "Greek yogurt",
            effect: "more protein, similar tang",
          },
          {
            type: "more-common",
            label: "Use yogurt + salsa",
            replacement: "Greek yogurt + salsa",
            effect: "tastes fresh, easy ingredients",
          },
        ],
      },
    ],
    "ice-cream": [
      {
        id: "ing-1",
        original: "milk or cream",
        current: "—",
        amount: "2 cups",
        reason: "Dairy choice affects creaminess and protein quietly.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Use half-and-half",
            replacement: "half-and-half",
            effect: "closest classic richness",
          },
          {
            type: "higher-protein",
            label: "Use protein milk blend",
            replacement: "protein milk blend",
            effect: "more protein, slightly lighter body",
          },
          {
            type: "more-common",
            label: "Use regular milk",
            replacement: "whole milk",
            effect: "common, smaller protein gain",
          },
        ],
      },
      {
        id: "ing-2",
        original: "no yogurt",
        current: "—",
        amount: "1 cup",
        reason: "Greek yogurt gives body without weirdness when blended smooth.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Skip yogurt",
            replacement: "no yogurt",
            effect: "closest taste, less protein",
          },
          {
            type: "higher-protein",
            label: "Use Greek yogurt",
            replacement: "Greek yogurt",
            effect: "more protein, mild tang",
          },
          {
            type: "simpler",
            label: "Use skyr",
            replacement: "skyr",
            effect: "more protein, still dairy-based",
          },
        ],
      },
      {
        id: "ing-3",
        original: "no protein powder",
        current: "—",
        amount: "optional",
        reason: "Protein powder adds gain when texture is protected by fat/flavor.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Skip protein powder",
            replacement: "no protein powder",
            effect: "closest taste, less protein",
          },
          {
            type: "higher-protein",
            label: "Add whey (small)",
            replacement: "whey protein (small amount)",
            effect: "more protein, watch bitterness",
          },
          {
            type: "cheaper",
            label: "Use milk powder",
            replacement: "milk powder",
            effect: "cheaper in some places, adds body",
          },
        ],
      },
      {
        id: "ing-4",
        original: "vanilla flavoring",
        current: "—",
        amount: "to taste",
        reason: "Stronger flavor helps keep “protein” from tasting obvious.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Use vanilla only",
            replacement: "vanilla",
            effect: "classic flavor",
          },
          {
            type: "more-common",
            label: "Use cocoa",
            replacement: "cocoa",
            effect: "covers protein flavor, still familiar",
          },
          {
            type: "simpler",
            label: "Use fruit puree",
            replacement: "fruit puree",
            effect: "easy, changes profile but tasty",
          },
        ],
      },
    ],
    pizza: [
      {
        id: "ing-1",
        original: "regular pizza dough",
        current: "—",
        amount: "1 pizza",
        reason: "Crust swap changes protein without redoing the whole pizza.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Use regular dough",
            replacement: "regular pizza dough",
            effect: "closest taste, less protein",
          },
          {
            type: "higher-protein",
            label: "Use protein crust (or swap flour)",
            replacement: "protein pizza crust",
            effect: "more protein, mild dough changes",
          },
          {
            type: "more-common",
            label: "Use whole-wheat + extra cheese",
            replacement: "whole-wheat dough + extra cheese",
            effect: "common ingredients, moderate gain",
          },
        ],
      },
      {
        id: "ing-2",
        original: "cheese",
        current: "—",
        amount: "1-1.5 cups",
        reason: "Cheese volume boosts protein and keeps it satisfying.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Keep cheese normal",
            replacement: "cheese",
            effect: "classic flavor",
          },
          {
            type: "higher-protein",
            label: "Add cottage cheese dots",
            replacement: "cheese + cottage cheese",
            effect: "more protein, still melty",
          },
          {
            type: "simpler",
            label: "Add extra mozzarella",
            replacement: "extra mozzarella",
            effect: "more protein, minimal taste change",
          },
        ],
      },
      {
        id: "ing-3",
        original: "pepperoni (optional)",
        current: "—",
        amount: "1 cup",
        reason: "Lean meat and beans are practical protein add-ons.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Use pepperoni only",
            replacement: "pepperoni",
            effect: "classic, smaller protein gain",
          },
          {
            type: "higher-protein",
            label: "Use chicken or turkey",
            replacement: "chicken or turkey",
            effect: "more protein, still savory",
          },
          {
            type: "vegetarian",
            label: "Use beans",
            replacement: "beans",
            effect: "vegetarian, different bite",
          },
        ],
      },
      {
        id: "ing-4",
        original: "pizza sauce + herbs",
        current: "—",
        amount: "1/2 cup",
        reason: "Sauce keeps identity; keep it simple.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Keep sauce standard",
            replacement: "pizza sauce",
            effect: "closest to original",
          },
          {
            type: "more-common",
            label: "Add parmesan to sauce",
            replacement: "pizza sauce + parmesan",
            effect: "more protein without niche ingredients",
          },
          {
            type: "simpler",
            label: "Use basic jar sauce",
            replacement: "jar pizza sauce + herbs",
            effect: "practical, easy",
          },
        ],
      },
    ],
    "chicken-tenders": [
      {
        id: "ing-1",
        original: "chicken tenders",
        current: "—",
        amount: "1 lb",
        reason: "Chicken is the protein anchor for tenders.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Use chicken tenders",
            replacement: "chicken tenders",
            effect: "classic, easiest",
          },
          {
            type: "higher-protein",
            label: "Use chicken breast strips",
            replacement: "chicken breast strips",
            effect: "more consistent protein, slightly leaner",
          },
          {
            type: "simpler",
            label: "Use a leaner cut",
            replacement: "lean chicken strips",
            effect: "small change, good protein gain",
          },
        ],
      },
      {
        id: "ing-2",
        original: "breadcrumbs",
        current: "—",
        amount: "1 cup",
        reason: "Coating sets crunch; protein versions are about crumb tweaks.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Use regular breadcrumbs",
            replacement: "breadcrumbs",
            effect: "closest crunch, less protein",
          },
          {
            type: "higher-protein",
            label: "Add parmesan to crumbs",
            replacement: "breadcrumbs + parmesan",
            effect: "more protein, sharper flavor",
          },
          {
            type: "more-common",
            label: "Use high-protein breadcrumbs",
            replacement: "high-protein breadcrumbs",
            effect: "more protein, similar cooking",
          },
        ],
      },
      {
        id: "ing-3",
        original: "egg wash",
        current: "—",
        amount: "2 eggs",
        reason: "Yogurt in the marinade boosts protein and tenderness.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Use egg wash only",
            replacement: "egg wash",
            effect: "classic taste, less protein",
          },
          {
            type: "higher-protein",
            label: "Add Greek yogurt to marinade",
            replacement: "egg wash + Greek yogurt",
            effect: "more protein, tender inside",
          },
          {
            type: "simpler",
            label: "Use a yogurt dip later",
            replacement: "egg wash + yogurt dip later",
            effect: "simple, moderate protein gain",
          },
        ],
      },
      {
        id: "ing-4",
        original: "dipping sauce",
        current: "—",
        amount: "to serve",
        reason: "Dips can add protein without changing the main bite.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Use your usual dip",
            replacement: "basic dipping sauce",
            effect: "closest flavor",
          },
          {
            type: "higher-protein",
            label: "Use Greek yogurt dip",
            replacement: "Greek yogurt dip",
            effect: "more protein, tangy",
          },
          {
            type: "more-common",
            label: "Use yogurt + seasoning",
            replacement: "Greek yogurt + seasoning",
            effect: "easy, protein up",
          },
        ],
      },
    ],
    generic: [
      {
        id: "ing-1",
        original: "familiar base",
        current: "—",
        amount: "main portion",
        reason: "Keep the dish recognizable by only changing the base slightly.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Keep the base as-is",
            replacement: "familiar base",
            effect: "closest taste, less protein",
          },
          {
            type: "higher-protein",
            label: "Switch to a higher-protein base",
            replacement: "higher-protein base",
            effect: "more protein, slightly different texture",
          },
          {
            type: "simpler",
            label: "Use a half-and-half swap",
            replacement: "half normal, half high-protein",
            effect: "moderate gain, minimal weirdness",
          },
        ],
      },
      {
        id: "ing-2",
        original: "sauce or binder",
        current: "—",
        amount: "enough to bind",
        reason: "Dairy blends help protein changes still taste like home cooking.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Keep your usual sauce",
            replacement: "your usual sauce",
            effect: "closest taste",
          },
          {
            type: "higher-protein",
            label: "Blend Greek yogurt/cottage cheese",
            replacement: "Greek yogurt/cottage cheese (blended)",
            effect: "more protein, keep creaminess",
          },
          {
            type: "more-common",
            label: "Add light sour cream",
            replacement: "sour cream",
            effect: "easy, moderate boost",
          },
        ],
      },
      {
        id: "ing-3",
        original: "protein add-on (optional)",
        current: "—",
        amount: "as needed",
        reason: "This is where we add the most protein without breaking the dish identity.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Keep protein light",
            replacement: "small chicken/beans portion",
            effect: "closer to original, modest protein gain",
          },
          {
            type: "higher-protein",
            label: "Increase chicken/beans",
            replacement: "larger chicken/beans portion",
            effect: "more protein, slightly heavier meal",
          },
          {
            type: "vegetarian",
            label: "Use vegetarian protein",
            replacement: "tofu/tempeh/beans",
            effect: "vegetarian, different bite",
          },
        ],
      },
      {
        id: "ing-4",
        original: "liquid/seasoning",
        current: "—",
        amount: "as needed",
        reason: "Realism tweaks keep the result practical.",
        swapOptions: [
          {
            type: "more-authentic",
            label: "Keep the liquid unchanged",
            replacement: "regular broth/milk",
            effect: "closest texture",
          },
          {
            type: "higher-protein",
            label: "Use protein milk or higher-protein broth",
            replacement: "protein milk or higher-protein broth",
            effect: "more protein, small flavor change",
          },
          {
            type: "simpler",
            label: "Use pantry staples",
            replacement: "pantry staples adjustment",
            effect: "practical, modest protein boost",
          },
        ],
      },
    ],
  };

  return { baseIngredientsByCategory, versionsById: templates[category].versions.versionsById };
}

function buildVersion(
  dish: string,
  category: DishCategory,
  version: RecipeVersion["id"],
  sliders: SliderValues,
  overrides: IngredientOverride[],
  transformationMode: TransformationMode | undefined,
  addVeggies: boolean | undefined
): RecipeVersion {
  const baseProtein = baseProteinForDish(dish);
  const estimate = computeProteinEstimate(baseProtein, sliders, version);
  const delta = Math.max(0, estimate - baseProtein);

  const { tasteScore, realismScore, aggressivenessScore } = versionScores(sliders, version);

  const templates = dishTemplates(category);
  const baseIngredients = templates.baseIngredientsByCategory[category].map((ing) => ({ ...ing }));

  const versionsById = templates.versionsById;
  const mapping = versionsById[version];

  // Defensive fallback if category is misconfigured.
  const ingredientsById = mapping
    ? mapping.ingredientsById
    : (_ingredientId: string) => "—";

  const ingredientsUnshadowed = baseIngredients.map((ing) => ({
    ...ing,
    current: ingredientsById(ing.id),
  }));
  const ingredientsWithMode = applyTransformationModeDefaults(ingredientsUnshadowed, transformationMode);
  const ingredients = withMockVeggieAdditions(
    applyOverrides(ingredientsWithMode, overrides),
    addVeggies,
    dish,
    category,
    version
  );

  const label: RecipeVersion["label"] =
    version === "close-match"
      ? "Close Match"
      : version === "balanced"
        ? "Balanced"
        : transformationMode === "lean"
          ? "Fully Light"
          : "Full Send";

  const narrative = dishNarrative(dish, category, version);
  const summary =
    narrative?.summary ??
    (version === "close-match"
      ? "Keeps the original feel with small protein-focused upgrades."
      : version === "balanced"
        ? "Best compromise: meaningfully higher protein without making it weird."
        : "Strongest push on protein with bigger, still-home-cookable swaps.");

  const why =
    narrative?.why ??
    (version === "close-match"
      ? "Uses familiar substitutions first, keeping flavor and texture as close as possible."
      : version === "balanced"
        ? "Combines practical protein add-ons with swaps that still cook like the original."
        : "Prioritizes protein gain with aggressive but still home-cookable ingredient changes.");

  const modePrefix = transformationMode === "lean" ? "Lean mode — " : "";

  const stepsTemplate = mapping?.steps ?? (["Cook as usual.", "Use protein-friendly swaps.", "Season and serve."] as RecipeStep[]);

  const transformationByComponent: TransformationByComponent = {
    protein: [summary],
    carbBase: [],
    sauceBroth: [],
    fat: [],
    toppings: [],
  };
  const methodAdjustments =
    stepsTemplate.length >= 2
      ? stepsTemplate.slice(0, Math.min(6, stepsTemplate.length))
      : ["Apply ingredient swaps above.", "Cook through and taste before serving."];

  const cookTimeMinutes =
    version === "close-match" ? 25 : version === "balanced" ? 38 : transformationMode === "lean" ? 42 : 52;
  const difficulty: RecipeVersion["difficulty"] =
    version === "close-match" ? "Easy" : version === "balanced" ? "Medium" : "Takes effort";

  return {
    id: version,
    label,
    summary: modePrefix ? `${modePrefix}${summary}` : summary,
    cookTimeMinutes,
    difficulty,
    macros: { p: estimate, d: delta },
    tasteScore,
    realismScore,
    aggressivenessScore,
    why: modePrefix ? `${modePrefix}${why}` : why,
    adds: addVeggies ? [{ note: mockVeggieAddition(dish, category, version).reason }] : [],
    transformationByComponent,
    methodAdjustments,
    ingredients,
    steps: stepsTemplate,
  };
}

function overridesForTarget(request: RegenerationRequest, version: RecipeVersion["id"]) {
  if (request.targetVersion && request.targetVersion !== version) return [];
  return request.overrides ?? [];
}

export function generateMockProteinifyResponse(
  request: RegenerationRequest
): ProteinifyResponse {
  const dish = request.dish.trim() || "dish";
  const sliders = request.sliders;
  const transformationMode = request.transformationMode;
  const category = detectCategory(dish);

  const versions: RecipeVersion[] = (["close-match", "balanced", "max-protein"] as const).map(
    (version) => {
      const overrides = overridesForTarget(request, version);
      return buildVersion(dish, category, version, sliders, overrides, transformationMode, request.addVeggies);
    }
  );

  // Ensure exact tuple type: [close-match, balanced, max-protein]
  const v0 = versions[0] as RecipeVersion;
  const v1 = versions[1] as RecipeVersion;
  const v2 = versions[2] as RecipeVersion;

  return {
    inputDish: dish,
    assumptions: assumptionsForDish(dish, category),
    versions: [v0, v1, v2] as [RecipeVersion, RecipeVersion, RecipeVersion],
  };
}

/** Full 3-version response: each version uses its own override list (for API full generate). */
export function generateFullProteinifyResponse(args: {
  dish: string;
  sliders: SliderValues;
  overridesByVersion: Record<RecipeVersion["id"], IngredientOverride[]>;
  transformationMode?: TransformationMode;
  addVeggies?: boolean;
}): ProteinifyResponse {
  const closeRes = generateMockProteinifyResponse({
    dish: args.dish,
    sliders: args.sliders,
    overrides: args.overridesByVersion["close-match"],
    targetVersion: "close-match",
    transformationMode: args.transformationMode,
    addVeggies: args.addVeggies,
  });
  const balancedRes = generateMockProteinifyResponse({
    dish: args.dish,
    sliders: args.sliders,
    overrides: args.overridesByVersion.balanced,
    targetVersion: "balanced",
    transformationMode: args.transformationMode,
    addVeggies: args.addVeggies,
  });
  const maxRes = generateMockProteinifyResponse({
    dish: args.dish,
    sliders: args.sliders,
    overrides: args.overridesByVersion["max-protein"],
    targetVersion: "max-protein",
    transformationMode: args.transformationMode,
    addVeggies: args.addVeggies,
  });

  return {
    inputDish: closeRes.inputDish,
    assumptions: closeRes.assumptions,
    versions: [closeRes.versions[0], balancedRes.versions[1], maxRes.versions[2]],
  };
}

/** After single-version regeneration, merge the new slot into the previous full response. */
export function mergeRegeneratedVersion(
  previous: ProteinifyResponse,
  targetVersion: RecipeVersion["id"],
  regenerated: ProteinifyResponse
): ProteinifyResponse {
  const idx = targetVersion === "close-match" ? 0 : targetVersion === "balanced" ? 1 : 2;
  const v = regenerated.versions[idx];
  return {
    inputDish: regenerated.inputDish,
    assumptions: regenerated.assumptions,
    versions: [
      idx === 0 ? v : previous.versions[0],
      idx === 1 ? v : previous.versions[1],
      idx === 2 ? v : previous.versions[2],
    ],
  };
}

