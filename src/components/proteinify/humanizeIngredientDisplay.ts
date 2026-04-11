/**
 * Light display-layer cleanup for awkward model phrasing (kitchen-real wording).
 * Does not change API data — only what users read in the UI / clipboard.
 */
const PAIRS: [RegExp, string][] = [
  [/part-skim egg/gi, "egg white instead of whole egg"],
  [/reduced-lipid/gi, "reduced-fat"],
  [/lean protein source/gi, "lean chicken breast"],
  [/off-heat paste method/gi, "stirred in off the heat as a smooth paste"],
  [/off heat paste/gi, "paste stirred in off the heat"],
  [/lipid-reduced/gi, "lower-fat"],
  [/\bnutrient-dense\b/gi, ""],
  [/\boff avoids\b/gi, "Off the heat, this avoids"],
  [/\boff cheese melts\b/gi, "Off the heat, the cheese melts"],
  [/\boff the heat,\s*off\b/gi, "off the heat"],
  [/medium al dente pasta provides structure/gi, "Cook the pasta to a firm al dente so it holds up in the sauce"],
];

export function humanizeIngredientDisplay(text: string): string {
  let s = text;
  for (const [re, rep] of PAIRS) {
    s = s.replace(re, rep);
  }
  return s
    .replace(/\s*,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*[,.]\s*|\s+$/g, "")
    .replace(/^\s+|\s+$/g, "");
}
