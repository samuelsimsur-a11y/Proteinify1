/**
 * Manual verification for dish classifier + generation fixes.
 * Usage: node --env-file=.env.local scripts/test-generation-fixes.mjs
 */

const BASE = process.env.TEST_API_BASE || "http://localhost:3000";

const CASES = [
  { name: "Chocolate Lava Cake", checks: ["no_whey_batter", "dessert"] },
  { name: "Vegan Lentil Dal", checks: ["vegan", "full_send"] },
  { name: "Jollof Rice", checks: ["component_boundary"] },
  { name: "Chicken Tikka", checks: ["high_baseline"] },
  { name: "Dumplings", checks: ["disambiguation"] },
];

function haystackFromResponse(body) {
  if (body.needsDisambiguation) return JSON.stringify(body).toLowerCase();
  const parts = [];
  for (const v of body.versions ?? []) {
    parts.push(v.summary, ...(v.swapSummary ?? []), JSON.stringify(v.transformationByComponent));
    for (const i of v.ingredients ?? []) parts.push(i.name, i.note);
    for (const s of v.instructions ?? []) parts.push(s.step);
  }
  return parts.join("\n").toLowerCase();
}

async function postGenerate(dish) {
  const res = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dish, mode: "wisedish", servings: 1 }),
  });
  const json = await res.json();
  return { status: res.status, json };
}

function evaluate(caseName, body) {
  const text = haystackFromResponse(body);
  const lines = [];

  if (body.needsDisambiguation) {
    lines.push(`DISAMBIGUATION: ${body.possibleVariants?.join(" | ")}`);
    return lines.join("\n");
  }

  const cls = body.classification;
  if (cls) {
    lines.push(
      `classification: type=${cls.dish_type} baseline=${cls.baseline_protein_g}g flags=${(cls.dietary_flags || []).join(",") || "none"}`
    );
  }

  const full = body.versions?.find((v) => v.name === "Full Send");
  const balanced = body.versions?.find((v) => v.name === "Balanced");
  if (full) {
    lines.push(`Full Send: +${full.proteinDeltaG}g (${full.originalProteinG}→${full.totalProteinG}g)`);
    lines.push(`  swaps: ${(full.swapSummary || []).join("; ")}`);
  }
  if (balanced) {
    lines.push(`Balanced: ${(balanced.swapSummary || []).join("; ")}`);
  }

  const animal = /\b(chicken|beef|pork|fish|egg|whey|casein|dairy|yogurt|cheese)\b/i.test(text);
  const wheyInText = /\bwhey\b/i.test(text);
  const cottage = /cottage/i.test(text);
  lines.push(`prose scan: whey=${wheyInText} animal/dairy=${animal} cottage=${cottage}`);

  if (caseName.includes("Lava")) {
    lines.push(wheyInText ? "FAIL: whey mentioned" : "PASS: no whey in prose");
  }
  if (caseName.includes("Vegan")) {
    lines.push(!animal ? "PASS: no animal products in prose" : "FAIL: animal/dairy in prose");
  }
  if (caseName.includes("Jollof")) {
    const powderInRice = /protein powder.*rice|rice.*protein powder|whey.*rice base/i.test(text);
    lines.push(powderInRice ? "FAIL: protein in rice base" : "PASS: no protein powder in rice base (heuristic)");
  }
  if (caseName.includes("Tikka")) {
    lines.push(
      cls?.baseline_protein_g >= 35
        ? "PASS: high baseline flagged"
        : `WARN: baseline=${cls?.baseline_protein_g ?? "?"}`
    );
  }

  return lines.join("\n");
}

async function main() {
  console.log(`Testing against ${BASE}\n`);
  for (const c of CASES) {
    console.log(`\n=== ${c.name} ===`);
    try {
      const { status, json } = await postGenerate(c.name);
      if (status !== 200) {
        console.log(`HTTP ${status}:`, json.error || json);
        continue;
      }
      console.log(evaluate(c.name, json));
    } catch (e) {
      console.log("ERROR:", e.message);
      console.log("(Start dev server: npm run dev)");
    }
  }
}

main();
