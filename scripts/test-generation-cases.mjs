#!/usr/bin/env node
/**
 * Manual verification for the 5 classifier + generation test cases.
 * Usage: node scripts/test-generation-cases.mjs [baseUrl]
 * Requires OPENAI_API_KEY in env for live calls.
 */

const BASE = process.argv[2] || process.env.TEST_BASE_URL || "http://localhost:3000";

const CASES = [
  {
    name: "Chocolate Lava Cake",
    dish: "Chocolate Lava Cake",
    mode: "proteinify",
    expectDisambiguation: false,
    check(body) {
      const issues = [];
      const text = JSON.stringify(body.versions || []).toLowerCase();
      if (/\bwhey\b/.test(text) && /(batter|dough|mix|cake)/.test(text)) {
        issues.push("whey in hot batter/mix");
      }
      if (!body.classification || body.classification.dish_type !== "dessert") {
        issues.push(`expected dessert classification, got ${body.classification?.dish_type}`);
      }
      const full = body.versions?.find((v) => v.name === "Full Send");
      if (full && !/texture|reinterpretation|⚠/i.test(full.summary + JSON.stringify(full.swapSummary))) {
        issues.push("Full Send missing texture warning (soft check)");
      }
      return issues;
    },
  },
  {
    name: "Vegan Lentil Dal",
    dish: "Vegan Lentil Dal",
    mode: "proteinify",
    check(body) {
      const issues = [];
      const text = JSON.stringify(body).toLowerCase();
      for (const bad of ["chicken", "whey", "casein", "butter", "ghee", "cream cheese", "egg"]) {
        if (text.includes(bad)) issues.push(`found animal/dairy: ${bad}`);
      }
      if (!body.classification?.dietary_flags?.includes("vegan")) {
        issues.push("missing vegan flag on classification");
      }
      return issues;
    },
  },
  {
    name: "Jollof Rice",
    dish: "Jollof Rice",
    mode: "proteinify",
    check(body) {
      const issues = [];
      const text = JSON.stringify(body.versions || []).toLowerCase();
      if (/protein powder|whey isolate/.test(text) && /(rice|jollof|base)/.test(text)) {
        issues.push("protein powder in rice base");
      }
      return issues;
    },
  },
  {
    name: "Chicken Tikka",
    dish: "Chicken Tikka",
    mode: "proteinify",
    check(body) {
      const issues = [];
      if ((body.classification?.baseline_protein_g ?? 0) < 35) {
        issues.push(`baseline ${body.classification?.baseline_protein_g} < 35`);
      }
      const close = body.versions?.find((v) => v.name === "Close Match");
      if (close && /whey|protein powder/i.test(JSON.stringify(close.swapSummary))) {
        issues.push("Close Match uses whey");
      }
      return issues;
    },
  },
  {
    name: "Dumplings",
    dish: "Dumplings",
    mode: "proteinify",
    expectDisambiguation: true,
    check(body) {
      const issues = [];
      if (!body.needsDisambiguation) issues.push("expected needsDisambiguation");
      if ((body.possibleVariants?.length ?? 0) < 2) issues.push("expected multiple variants");
      return issues;
    },
  },
];

async function runCase(testCase) {
  const res = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dish: testCase.dish, mode: testCase.mode, servings: 1 }),
  });
  const body = await res.json();
  if (!res.ok) {
    return { ok: false, issues: [`HTTP ${res.status}: ${body.error || res.statusText}`] };
  }
  const issues = testCase.check(body);
  if (testCase.expectDisambiguation && !body.needsDisambiguation) {
    issues.push("expected disambiguation response");
  }
  if (!testCase.expectDisambiguation && body.needsDisambiguation) {
    issues.push("unexpected disambiguation");
  }
  return { ok: issues.length === 0, issues, body };
}

async function main() {
  console.log(`Testing against ${BASE}\n`);
  let passed = 0;
  for (const tc of CASES) {
    process.stdout.write(`${tc.name}... `);
    try {
      const result = await runCase(tc);
      if (result.ok) {
        console.log("PASS");
        passed++;
      } else {
        console.log("FAIL");
        for (const i of result.issues) console.log(`  - ${i}`);
      }
    } catch (e) {
      console.log("ERROR", e instanceof Error ? e.message : e);
    }
  }
  console.log(`\n${passed}/${CASES.length} passed`);
  process.exit(passed === CASES.length ? 0 : 1);
}

main();
