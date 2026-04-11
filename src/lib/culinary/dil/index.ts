// src/lib/culinary/dil/index.ts
// Public API surface — import only from here, not from internal modules.

export { getDishByIdOrAlias } from "./loader";
export { validateDILIntegrity } from "./loader";
export { buildConstraintPromptFragment, buildToolDefinition, buildAPIPayload, extractSwapsFromResponse } from "./promptBuilder";
export { validateSwap } from "./validator";
export type {
  DishDNA,
  SwapGuard,
  ValidationResult,
  ValidationEvent,
  ValidateSwapOptions,
  SwapInput,
  UserGoal,
} from "./schemas";

// ─── Integration quick-start ──────────────────────────────────────────────────
//
// import {
//   getDishByIdOrAlias,
//   buildAPIPayload,
//   extractSwapsFromResponse,
//   validateSwap,
//   validateDILIntegrity,
// } from "@/lib/culinary/dil";
//
// // Run at server startup (throws if data is inconsistent)
// validateDILIntegrity();
//
// // On user request:
// const dish = getDishByIdOrAlias(userInput);
// if (!dish) return fallback();
//
// const payload = buildAPIPayload(dish, userMessage);
// const response = await fetch("https://api.anthropic.com/v1/messages", {
//   method: "POST",
//   headers: { "Content-Type": "application/json" },
//   body: JSON.stringify(payload),
// });
// const data = await response.json();
// const swaps = extractSwapsFromResponse(data.content) ?? [];
//
// const result = validateSwap(dish, swaps, {
//   userGoal: "protein-boost",    // from user profile or detected intent
//   onEvent: (event) => analytics.track("dil_validation", event),
// });
//
// if (!result.isValid) {
//   // Surface violations with educationalContext + goalAlternatives to user
//   // result.violations[0].allowOverride controls whether to offer "do it anyway"
// }
// // Otherwise: proceed to recipe expansion with validated swap context
