import OpenAI from "openai";

const CLASSIFIER_JSON_SCHEMA = {
  name: "dish_classification",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "dish_type",
      "cooking_method",
      "dietary_flags",
      "baseline_protein_g",
      "ambiguity_score",
      "assumed_variant",
      "possible_variants",
      "texture_critical",
      "texture_note",
      "dish_components",
      "protein_component",
    ],
    properties: {
      dish_type: { type: "string", enum: ["dessert", "main", "side", "snack", "drink", "unknown"] },
      cooking_method: {
        type: "string",
        enum: ["bake", "steam", "fry", "raw", "boil", "grill", "no_cook", "mixed", "unknown"],
      },
      dietary_flags: {
        type: "array",
        items: {
          type: "string",
          enum: ["vegan", "vegetarian", "halal", "kosher", "dairy_free", "gluten_free"],
        },
      },
      baseline_protein_g: { type: "number" },
      ambiguity_score: { type: "string", enum: ["low", "medium", "high"] },
      assumed_variant: { type: ["string", "null"] },
      possible_variants: { type: "array", items: { type: "string" } },
      texture_critical: { type: "boolean" },
      texture_note: { type: ["string", "null"] },
      dish_components: { type: "array", items: { type: "string" } },
      protein_component: { type: ["string", "null"] },
    },
  },
};

async function classify(dishName) {
  const openai = new OpenAI();
  const prompt = `Classify this dish for a protein optimization engine.
Return JSON only matching this schema exactly.
Be conservative with dietary_flags — only flag if the dish is traditionally that way.
For baseline_protein_g: estimate for a standard restaurant serving.
For texture_critical: true only if the dish's identity depends on a specific texture that protein additions could destroy.
For dish_components: identify separate structural elements.
For ambiguity_score: high if the same name refers to significantly different dishes across cultures.

Dish name: "${dishName}"`;

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_CLASSIFIER_MODEL || "gpt-4o-mini",
    temperature: 0.1,
    max_completion_tokens: 600,
    response_format: { type: "json_schema", json_schema: CLASSIFIER_JSON_SCHEMA },
    messages: [
      { role: "system", content: "You classify dishes. Return JSON only." },
      { role: "user", content: prompt },
    ],
  });
  return JSON.parse(completion.choices[0].message.content);
}

const dishes = [
  "Chocolate Lava Cake",
  "Vegan Lentil Dal",
  "Jollof Rice",
  "Chicken Tikka",
  "Dumplings",
];

for (const d of dishes) {
  console.log(`\n=== ${d} ===`);
  try {
    const c = await classify(d);
    console.log(JSON.stringify(c, null, 2));
    if (d === "Dumplings" && c.ambiguity_score === "high" && c.possible_variants.length > 1) {
      console.log("→ Would show disambiguation UI");
    }
  } catch (e) {
    console.log("ERROR", e.message);
  }
}
