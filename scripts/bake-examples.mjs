#!/usr/bin/env node
// Bakes results for the example dishes into src/data/exampleResults.json so the app can show
// them instantly. Calls your live API (uses your OpenAI key on the server; ~7 generations).
//
//   npm run bake:examples                         # uses https://wisedish.vercel.app
//   npm run bake:examples -- http://localhost:3000
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const BASE = (process.argv[2] || process.env.BAKE_BASE_URL || "https://wisedish.vercel.app").replace(/\/$/, "");
const OUT = fileURLToPath(new URL("../src/data/exampleResults.json", import.meta.url));
const DISHES = ["Mac & Cheese", "Biryani", "Ramen", "Chicken Tikka", "Pad Thai", "Birria Tacos", "Alfredo"];
const MODES = (process.env.BAKE_MODES || "wisedish").split(",").map((m) => m.trim()).filter(Boolean);
const SLIDERS = { tasteIntegrity: 8, proteinBoost: 6, pantryRealism: 8 };

async function generate(dish, mode) {
  const res = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dish: dish.toLowerCase(), sliders: SLIDERS, servings: 1, transformationMode: mode, addVeggies: false }),
    signal: AbortSignal.timeout(180_000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) throw new Error(`${res.status} ${json?.error ?? ""}`.trim());
  if (json.needsDisambiguation) throw new Error(`ambiguous (try one of: ${(json.possibleVariants || []).join(", ")})`);
  if (!Array.isArray(json.versions) || json.versions.length !== 3) throw new Error("unexpected response shape");
  return json;
}

const current = JSON.parse(await readFile(OUT, "utf8").catch(() => '{"version":1,"examples":{}}'));
const examples = { ...(current.examples || {}) };
let ok = 0;
for (const mode of MODES) {
  for (const dish of DISHES) {
    const key = `${mode}:${dish.toLowerCase()}`;
    process.stdout.write(`Baking ${key} … `);
    try {
      examples[key] = await generate(dish, mode);
      ok += 1;
      console.log("done");
    } catch (err) {
      console.log(`skipped (${err.message})`);
    }
  }
}
await writeFile(OUT, JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), examples }, null, 2) + "\n");
console.log(`\nSaved ${ok} new example(s) to src/data/exampleResults.json. Rebuild the app to ship them.`);
