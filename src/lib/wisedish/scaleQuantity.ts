/**
 * Scales the quantities inside a free-text ingredient amount ("1/2 cup", "140–180g", "2 large")
 * when the user changes portion size. Handles fractions, unicode fractions, mixed numbers,
 * decimals and ranges; leaves percentages, ratios, temperatures and times alone.
 */

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 1 / 2,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅕": 1 / 5,
  "⅖": 2 / 5,
  "⅗": 3 / 5,
  "⅘": 4 / 5,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
};
const UF = Object.keys(UNICODE_FRACTIONS).join("");

/** Denominators that read as cooking fractions; anything else (e.g. "93/7") is left untouched. */
const KITCHEN_DENOMINATORS = new Set([2, 3, 4, 5, 6, 8, 10, 12, 16]);

const NUM = `(?:\\d+\\s+\\d+\\/\\d+|\\d+\\s*[${UF}]|\\d+\\/\\d+|[${UF}]|\\d+(?:\\.\\d+)?)`;
const RANGE_SEP = `\\s*(?:-|–|—|to)\\s*`;
const QUANTITY_RE = new RegExp(`(?<![\\d.:/])(${NUM})(?:(${RANGE_SEP})(${NUM}))?`, "g");

/** Units/markers after a number that mean "don't scale this" (percent, temperature, ratio, time). */
const NON_SCALING_SUFFIX =
  /^\s*(?:%|°|:|x\b|min\b|mins\b|minutes?\b|hrs?\b|hours?\b|secs?\b|seconds?\b|-?\s*inch(?:es)?\b|in\.|cm\b|mm\b)/i;

const METRIC_UNIT = /^\s*(?:g|grams?|kg|mg|ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|oz|ounces?|lbs?|pounds?)\b/i;
const VOLUME_UNIT = /^\s*(?:cups?|tbsps?|tablespoons?|tsps?|teaspoons?)\b/i;

type Style = "fraction" | "unicode" | "decimal";

function parseNumber(token: string): number | null {
  const t = token.trim();
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (mixed) {
    const den = Number(mixed[3]);
    if (!KITCHEN_DENOMINATORS.has(den)) return null;
    return Number(mixed[1]) + Number(mixed[2]) / den;
  }
  const wholeUnicode = new RegExp(`^(\\d+)\\s*([${UF}])$`).exec(t);
  if (wholeUnicode) return Number(wholeUnicode[1]) + UNICODE_FRACTIONS[wholeUnicode[2]!]!;
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  if (frac) {
    const den = Number(frac[2]);
    if (!KITCHEN_DENOMINATORS.has(den)) return null;
    return Number(frac[1]) / den;
  }
  if (UNICODE_FRACTIONS[t] !== undefined) return UNICODE_FRACTIONS[t]!;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function styleOf(token: string): Style {
  if (new RegExp(`[${UF}]`).test(token)) return "unicode";
  if (token.includes("/")) return "fraction";
  return "decimal";
}

const FRIENDLY_FRACTIONS: [number, string, string][] = [
  [1 / 8, "1/8", "⅛"],
  [1 / 4, "1/4", "¼"],
  [1 / 3, "1/3", "⅓"],
  [3 / 8, "3/8", "⅜"],
  [1 / 2, "1/2", "½"],
  [5 / 8, "5/8", "⅝"],
  [2 / 3, "2/3", "⅔"],
  [3 / 4, "3/4", "¾"],
  [7 / 8, "7/8", "⅞"],
];

function formatFraction(value: number, unicode: boolean): string {
  if (value <= 0) return "0";
  let whole = Math.floor(value);
  const rest = value - whole;
  let label = "";
  let bestErr = rest; // error if we simply round down to the whole number
  for (const [v, ascii, uni] of FRIENDLY_FRACTIONS) {
    const err = Math.abs(rest - v);
    if (err < bestErr) {
      label = unicode ? uni : ascii;
      bestErr = err;
    }
  }
  if (1 - rest < bestErr) {
    whole += 1;
    label = "";
  }
  // Never print "0" for an ingredient that is actually in the recipe.
  if (!label) return whole === 0 ? (unicode ? "⅛" : "1/8") : String(whole);
  if (whole === 0) return label;
  return unicode ? `${whole}${label}` : `${whole} ${label}`;
}

function formatDecimal(value: number, metric: boolean): string {
  if (metric) {
    if (value >= 100) return String(Math.round(value / 5) * 5);
    if (value >= 10) return String(Math.round(value));
    return String(Math.round(value * 10) / 10);
  }
  if (value >= 10) return String(Math.round(value));
  return String(Math.round(value * 100) / 100);
}

function formatScaled(value: number, original: string, after: string): string {
  const metric = METRIC_UNIT.test(after);
  const volume = VOLUME_UNIT.test(after);
  const style = styleOf(original);
  if (metric) return formatDecimal(value, true);
  if (style !== "decimal" || volume) return formatFraction(value, style === "unicode");
  // Unitless counts ("2 eggs", "1 large onion"): halves read better than decimals.
  if (!Number.isInteger(value) && !original.includes(".")) return formatFraction(value, false);
  return formatDecimal(value, false);
}

export function scaleQuantityText(amount: string, factor: number): string {
  if (!amount || !Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-9) return amount;

  const scaled = amount.replace(QUANTITY_RE, (match, a: string, sep: string | undefined, b: string | undefined, offset: number) => {
    const after = amount.slice(offset + match.length);
    if (NON_SCALING_SUFFIX.test(after)) return match;
    // "for 2 servings" is rewritten separately by the caller.
    const before = amount.slice(0, offset);
    if (/for\s*$/i.test(before) && /^\s*servings?\b/i.test(after)) return match;

    const va = parseNumber(a);
    if (va === null) return match;
    if (b === undefined || sep === undefined) return formatScaled(va * factor, a, after);

    const vb = parseNumber(b);
    if (vb === null) return match;
    return `${formatScaled(va * factor, a, after)}${sep}${formatScaled(vb * factor, b, after)}`;
  });

  return scaled;
}

/** Scales an ingredient amount and updates any "(for N servings)" note to the new portion count. */
export function scaleIngredientAmount(amount: string, fromServings: number, toServings: number): string {
  if (fromServings <= 0 || toServings === fromServings) return amount;
  return scaleQuantityText(amount, toServings / fromServings).replace(
    /\(for\s+\d+\s+servings?\)/i,
    `(for ${toServings} servings)`
  );
}
