/**
 * Cooking-method locks and named-dish overrides — ported from the legacy compact prompt stack
 * into the active system prompt path.
 */
export function buildDishOverrideFragment(dishLower: string): string {
  const blocks: string[] = [];

  blocks.push(`
COOKING METHOD LOCKS (apply before selecting protein techniques):
- DRY RUB / GRILL / SMOKE (jerk, BBQ, satay): no yogurt/curd marinade; no bone broth baste as primary moisture; no TVP on grill.
- STIR-FRY / WOK (pad thai, fried rice): no broth flood; no edamame in pad thai; no yogurt marinade; TVP banned under 15 min wok.
- BROTH / NOODLE (pho, ramen): broth-native protein only — no cottage cheese/cream/yogurt in hot broth; no whey in boiling liquid.
- DEEP-FRY (falafel, karaage): no free-water binders; falafel stays vegan — no egg in mixture; no protein powder in paste.
- LAYERED / DUM STEAM (biryani): obey DIL block — no cauliflower rice, no soy chunks in dum vessel.
`.trim());

  if (dishLower.includes("jerk")) {
    blocks.push(`
JERK CHICKEN OVERRIDE:
- Dry-rub + smoke/grill only — never yogurt, paneer, or tandoori marinade language.
- Valid protein levers: +20–30% same chicken cut, leaner portion timing, side beans/rice protein pairing.
`.trim());
  }

  if (dishLower.includes("pho")) {
    blocks.push(`
PHO BO OVERRIDE:
- Default pho bo unless user specifies pho ga. Broth = charred aromatics + spice + long beef simmer.
- Protein: extra thin-sliced beef or tendon — never dairy, whey, or powder in hot broth.
`.trim());
  }

  if (dishLower.includes("pad thai") || dishLower.includes("pad-thai") || dishLower.includes("padthai")) {
    blocks.push(`
PAD THAI OVERRIDE:
- Wok stir-fry — sauce is tamarind + fish sauce + palm sugar, reduced on noodles.
- BANNED: edamame, paneer, bone broth flood. Valid: extra shrimp, chicken, or pressed fried tofu.
`.trim());
  }

  if (dishLower.includes("falafel")) {
    blocks.push(`
FALAFEL OVERRIDE:
- Traditionally vegan deep-fried legume fritters — no egg, whey, or cottage cheese in the mixture.
- Valid: modestly larger portion of same mix; tahini on side for serving (not mixed into paste).
`.trim());
  }

  if (dishLower.includes("biryani")) {
    blocks.push(`
BIRYANI OVERRIDE (see DIL addon for full rules):
- No soy chunks, cauliflower rice, cottage cheese marinade, or whey except Full Send per DIL.
`.trim());
  }

  blocks.push(`
PANEER ZONE RULE: Paneer only in South Asian contexts (ghee/garam masala grammar). Banned in jerk, pho, pad thai, falafel, and all non–South Asian zones.
`.trim());

  return blocks.join("\n\n");
}
