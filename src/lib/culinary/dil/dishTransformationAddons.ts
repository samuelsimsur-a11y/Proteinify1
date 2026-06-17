import type { DishDNA } from "@/lib/culinary/dil/schemas";

const ADDONS: Record<string, string> = {
  "jerk-chicken": `
## Jerk chicken transformation priorities (DIL)

**Method lock:** Dry-rub + grill/smoke — no yogurt marinade, no paneer, no broth basting as primary moisture.
**Close Match:** +20–30% same bone-in chicken; tighten rub adhesion; lime at finish only.
**Balanced:** Leaner cut timing cues + modest portion increase; optional side protein (beans) named separately.
**Full Send:** Max portion + rub density; honest char/cook-time trade-off in summary — still no liquid marinade arc.
`.trim(),

  "pho-bo": `
## Pho bo transformation priorities (DIL)

**Broth lock:** Clear aromatic beef broth — charred onion/ginger + spice; no dairy, whey, or cottage cheese enrichment.
**Close Match:** +25% thin-sliced beef at bowl; keep flash-cook assembly.
**Balanced:** Add tendon/brisket for collagen; extra beef slices — broth clarity preserved.
**Full Send:** Max beef portion + concentrated bone simmer note; never protein powder in boiling broth.
`.trim(),

  "pad-thai": `
## Pad thai transformation priorities (DIL)

**Wok lock:** Tamarind–fish sauce–palm sugar reduced on noodles — not soup, not baked.
**BANNED:** edamame, paneer, bone broth flood, yogurt.
**Close Match:** +25% shrimp/chicken/tofu in wok pass; preserve noodle chew.
**Balanced:** Higher-protein noodle blend if texture stays chewy + extra protein in wok.
**Full Send:** Max shrimp/chicken/tofu stack; honest sauce reduction timing in summary.
`.trim(),

  falafel: `
## Falafel transformation priorities (DIL)

**Vegan fry lock:** No egg, whey, cottage cheese, or protein powder in the mixture — crisp shell is identity.
**Close Match:** +15–20% same mixture portion; herb/garlic density up without extra wet binders.
**Balanced:** Slightly larger balls + tahini on side (not mixed into paste if claiming vegan).
**Full Send:** Max portion within fry physics; note oil/temperature discipline honestly.
`.trim(),
};

export function buildDishTransformationAddon(dish: DishDNA): string | null {
  return ADDONS[dish.id] ?? null;
}

export function isCataloguedDilDish(dishId: string): boolean {
  return dishId === "biryani" || dishId in ADDONS;
}
