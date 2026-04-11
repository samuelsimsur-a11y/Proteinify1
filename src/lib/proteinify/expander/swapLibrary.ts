/**
 * Approved technique / swap codes for compact model output.
 * The expander turns codes + amount/target into full wire ingredients and steps.
 */

export const TECHNIQUE_CODES = [
  "bone-broth-substitute",
  "marinade-amplification",
  "more-identity-protein",
  "cottage-cheese-sauce",
  "soya-chunks-addition",
  "paneer-addition",
  "konjac-blend",
  "cauliflower-blend",
  "chickpea-pasta",
  "greek-yogurt-sub",
  "collagen-add",
  "whey-add",
  "birista-airfry",
  "extra-egg",
  "soft-boiled-egg-alongside",
  "edamame-add",
  "extra-beans",
] as const;

export type TechniqueCode = (typeof TECHNIQUE_CODES)[number];

export type TechniqueLibraryEntry = {
  code: TechniqueCode;
  /** Short ingredient / swap headline for the wire row. */
  note: string;
  /** Step template; expander fills {amount}, {target}, {dish}, {fatVehicle}, {acidAnchor}. */
  technique: string;
  /** Protein rationale (folded into ingredient reason). */
  proteinNote: string;
  heatWarning?: string;
  textureWarning?: string;
  /** When target is omitted in compact output. */
  defaultTarget: string;
  defaultAmount: string;
  /** Doc-only: cooking methods where this technique is a poor fit (prompt / human review). */
  cookingMethodBan?: string[];
  /** Doc-only: freeform cuisine guardrails (prompt / human review). */
  cuisineRestrictions?: string[];
  /** Doc-only: dish families where this technique is appropriate (prompt / human review). */
  cuisineWhitelist?: string[];
  /** Doc-only: dish families where this technique should not appear (prompt / human review). */
  cuisineBan?: string[];
};

export const SWAP_LIBRARY: Record<TechniqueCode, TechniqueLibraryEntry> = {
  "bone-broth-substitute": {
    code: "bone-broth-substitute",
    note: "Bone broth for water or thin stock. For biryani: specify as spiced meat stock, not generic bone broth",
    technique:
      "Replace cooking liquid 1:1 with unsalted bone broth where the recipe calls for water or weak stock — rice soak, braise, simmer base, or pasta/grain cook water for {dish}.",
    proteinNote: "Adds collagen and amino acids with minimal flavor shift when broth is mild.",
    cookingMethodBan: ["stir-fry", "dry-rub", "raw"],
    defaultTarget: "cooking liquid",
    defaultAmount: "1:1 vs water/stock",
  },
  "marinade-amplification": {
    code: "marinade-amplification",
    note: "Only applies where a marinade exists in the original dish",
    technique:
      "Increase marinade volume 30–50% on {target}, favoring Greek yogurt or strained curd so the protein film stays thick; rest per original timing.",
    proteinNote: "Extra dairy protein binds to the surface without changing the marinade spice profile.",
    cookingMethodBan: ["stir-fry", "dry-rub", "raw", "deep-fry"],
    defaultTarget: "primary protein",
    defaultAmount: "+30–50% marinade",
  },
  "more-identity-protein": {
    code: "more-identity-protein",
    note: "More identity protein (portion lift)",
    technique:
      "Increase {target} by 20–30% by weight for {dish}; adjust salt and sear time slightly — same cut, same prep, larger honest portion.",
    proteinNote: "Cleanest gain: same species/cut, no category change.",
    textureWarning: "Watch sear crowding; batch if needed so Maillard stays intact.",
    defaultTarget: "identity protein",
    defaultAmount: "+20–30%",
  },
  "cottage-cheese-sauce": {
    code: "cottage-cheese-sauce",
    note: "Cottage cheese in sauce (blended)",
    technique:
      "For creamy sauces on {dish}: rinse cottage cheese if the dish is mild, blend smooth with a splash of milk, then fold off heat into {target}; do not boil after adding.",
    proteinNote: "Casein-rich body replaces part of cream or milk solids for protein.",
    heatWarning: "Keep sauce below a simmer when folding cheese; curdling risk if boiled.",
    textureWarning: "Blend until smooth to avoid grainy sauce.",
    defaultTarget: "cream or cheese sauce",
    defaultAmount: "½–1 cup blended",
  },
  "soya-chunks-addition": {
    code: "soya-chunks-addition",
    note: "Soya chunks (TVP) rehydrated",
    technique:
      "Rehydrate soya chunks in hot salted water 8–10 min, squeeze dry, marinate in a spoon of the dish masala, then shallow-fry or toast before folding into {dish} with {target}.",
    proteinNote: "High-protein plant chunk that reads meaty when fried and spiced.",
    textureWarning: "Skip the squeeze/marinate/fry sequence and TVP tastes spongy.",
    cookingMethodBan: ["grill", "stir-fry", "raw", "dum-layered", "deep-fry"],
    defaultTarget: "curry or rice build",
    defaultAmount: "30–50 g dry per serving",
  },
  "paneer-addition": {
    code: "paneer-addition",
    note: "Paneer addition or bump",
    technique:
      "Add or increase paneer cubes; pat dry, quick-sear optional, then simmer gently in the sauce for {dish} so {target} stays tender.",
    proteinNote: "Culturally authentic milk protein bump in South Asian builds.",
    defaultTarget: "gravy or biryani layer",
    defaultAmount: "80–120 g per serving",
  },
  "konjac-blend": {
    code: "konjac-blend",
    note: "Konjac rice blend",
    technique:
      "Rinse konjac rice 60s, dry-toast in a hot pan 2–3 min, then fold in for the last 2–3 minutes only into {target} for {dish} — max ~30% of rice volume.",
    proteinNote: "Low-calorie bulk; pair with a protein-forward sauce or meat.",
    textureWarning: "Earlier cooking amplifies rubbery texture and odor.",
    defaultTarget: "cooked rice",
    defaultAmount: "≤30% of rice volume",
  },
  "cauliflower-blend": {
    code: "cauliflower-blend",
    note: "Cauliflower rice blend",
    technique:
      "Pulse cauliflower to rice-sized pieces; steam or sauté separately until dry, then fold up to 25% into {target} for {dish}; finish with extra fat or cheese if the dish is creamy.",
    proteinNote: "Adds volume; slightly earthier — compensate with fat vehicle or cheese.",
    textureWarning: "Above 25% the dish reads as cauliflower-forward.",
    defaultTarget: "rice or starch base",
    defaultAmount: "≤25% blend",
  },
  "chickpea-pasta": {
    code: "chickpea-pasta",
    note: "Chickpea or legume pasta swap",
    technique:
      "Cook chickpea pasta 1–2 min under box time; reserve extra pasta water for {dish} because legume pastas shed less starch — toss sauce with {target}.",
    proteinNote: "Higher-protein pasta category change — nuttier, firmer bite.",
    textureWarning: "Sauce may need more liquid and fat to coat.",
    defaultTarget: "wheat pasta",
    defaultAmount: "1:1 by weight",
  },
  "greek-yogurt-sub": {
    code: "greek-yogurt-sub",
    note: "Greek yogurt substitution",
    technique:
      "Replace part of cream, mayo, or sour cream with thick Greek yogurt in {target} for {dish}; temper into warm sauces off heat or below 70°C to avoid splitting.",
    proteinNote: "Dairy protein plus tang — balance with a pinch of sugar or fat if needed.",
    heatWarning: "Do not boil after yogurt is added; split risk.",
    defaultTarget: "creamy component",
    defaultAmount: "50–100% of dairy slot",
  },
  "collagen-add": {
    code: "collagen-add",
    note: "Unflavored collagen peptides",
    technique:
      "Whisk unflavored collagen into warm (not boiling) sauce, gravy, or braise liquid for {dish}; dissolve fully before combining with {target}.",
    proteinNote: "Invisible protein; best in wet, savory bases.",
    defaultTarget: "sauce or braise liquid",
    defaultAmount: "1 scoop (~10–15 g)",
  },
  "whey-add": {
    code: "whey-add",
    note: "Unflavored whey isolate (paste method)",
    technique:
      "Mix whey with 2 tbsp room-temperature liquid to a paste, then fold into warm (below 70°C) {target} for {dish}; never dump dry powder into hot sauce.",
    proteinNote: "High leucine boost when heat is controlled.",
    heatWarning: "Boiling causes curdling; paste method mandatory.",
    defaultTarget: "sauce or shake-off heat component",
    defaultAmount: "½–1 scoop",
  },
  "birista-airfry": {
    code: "birista-airfry",
    note: "Birista / fried onion or air-fry crisp layer",
    technique:
      "Build birista or air-fry thin onion slices until crisp; layer or fold into {dish} with {target} for aroma without extra oil puddle.",
    proteinNote: "Aroma layer; modest protein — pair with another code for large gains.",
    defaultTarget: "biryani or layered rice",
    defaultAmount: "as needed for layers",
  },
  "extra-egg": {
    code: "extra-egg",
    note: "Extra egg (whole or white)",
    technique:
      "Add an extra beaten egg, egg white, or yolk per serving where it fits the structure — bind a patty, enrich a sauce off heat, or fold into {target} for {dish}.",
    proteinNote: "Complete protein with minimal flavor when ratio is sane.",
    cuisineRestrictions: [
      "Italian cream sauces: 1–2 egg yolks off heat = Balanced or Full Send only, never Close Match; frame as classic enrichment. See system prompt STEP 1C.",
    ],
    defaultTarget: "binder or sauce",
    defaultAmount: "+1 egg per serving",
  },
  "soft-boiled-egg-alongside": {
    code: "soft-boiled-egg-alongside",
    note: "Soft-boiled egg alongside or on top",
    technique:
      "Cook eggs to jammy yolk (about 6–7 min), cool in ice water, peel, halve, and place on {target} for {dish} at service so the yolk enriches each bite without curdling the base.",
    proteinNote: "Whole egg protein with minimal structural change to the main build.",
    cuisineWhitelist: [
      "ramen",
      "japanese-noodle-soup",
      "pho",
      "vietnamese-noodle-soup",
      "broth-noodle-bowl",
      "biryani",
      "bibimbap",
      "donburi",
      "rice-bowl",
      "noodle-soup",
    ],
    cuisineBan: [
      "ceviche",
      "acid-cured-raw",
      "jerk-chicken",
      "dry-rub-grilled-protein",
      "falafel",
      "vegan-dishes",
      "plant-based-cultural-identity",
      "italian-pasta-soft-boil-unless-carbonara-adjacent",
    ],
    cuisineRestrictions: [
      "Eligibility: see system prompt STEP 1C — soft-boiled whitelist/ban and Italian pasta exception (carbonara-adjacent only, not Close Match).",
    ],
    defaultTarget: "bowl or soup surface",
    defaultAmount: "1 egg per serving",
  },
  "edamame-add": {
    code: "edamame-add",
    note: "Edamame stirred in",
    technique:
      "Blanch or thaw edamame; fold into {dish} near the end with {target} so color stays bright and skins do not wrinkle.",
    proteinNote: "Whole-food soy protein with clean flavor if not overcooked.",
    defaultTarget: "stir-fry, rice, or bowl",
    defaultAmount: "½ cup per serving",
  },
  "extra-beans": {
    code: "extra-beans",
    note: "Extra beans or lentils (appropriate style)",
    technique:
      "Add rinsed canned beans or properly cooked lentils to {target} for {dish}; season the legumes with a spoon of the dish base so they do not read bland.",
    proteinNote: "Fiber and protein; ensure cuisine fit (e.g., chickpeas in tagine, black beans in Latin bowls).",
    textureWarning: "Not a stand-in for identity meat in load-bearing dishes.",
    defaultTarget: "stew, curry, or bowl",
    defaultAmount: "½–1 cup cooked",
  },
};

export function isTechniqueCode(s: string): s is TechniqueCode {
  return (TECHNIQUE_CODES as readonly string[]).includes(s);
}
