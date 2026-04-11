// src/lib/culinary/dil/promptBuilder.ts
// FIX: guard codes are derived from the loader index — never hardcoded.
// FIX: exports a buildToolDefinition() for Anthropic tool_use API so the
//      LLM is structurally forced to return valid swap codes, not free text.

import type { DishDNA, SwapGuard } from "./schemas";
import { getGuardsForDish } from "./loader";

// ─── Constraint prompt fragment ───────────────────────────────────────────────

/**
 * Builds the constraint block injected into the system prompt.
 * Uses only the fields that are small and meaningful to the LLM;
 * does NOT dump the entire DishDNA (token budget).
 */
export function buildConstraintPromptFragment(dish: DishDNA): string {
  const relevantGuards = getGuardsForDish(dish);   // FIX: derived, not hardcoded
  const blockerCodes = relevantGuards
    .filter(g => g.severity === "blocker")
    .map(g => g.code);
  const warningCodes = relevantGuards
    .filter(g => g.severity === "warning")
    .map(g => g.code);
  const allValidCodes = relevantGuards.map(g => g.code);

  const arcSummary = dish.cookingArcs
    .map(arc => `${arc.track}: ${arc.sequence.join(" → ")}`)
    .join(" | ");

  const absentItems = dish.historicallyAbsent
    .filter(h => h.confidence === "definitive")
    .map(h => h.item)
    .join(", ");

  return `
## CULINARY GRAMMAR CONSTRAINTS — ${dish.displayName.toUpperCase()}
Zone: ${dish.cuisineZone}
Cooking arcs: ${arcSummary}
Identity method: ${dish.identityMethod}
Non-negotiables: ${dish.keyNonnegotiables.slice(0, 3).join("; ")}
Structurally absent (definitive): ${absentItems || "none specified"}

## SWAP CODE CONTRACT
You MUST call the apply_swap_codes tool with a JSON response.
Do NOT describe swaps in free text. Do NOT invent codes.

Valid codes for this dish: ${allValidCodes.length > 0 ? allValidCodes.join(" | ") : "(none — all free-text swaps require code mapping)"}

BLOCKED (blocker): ${blockerCodes.length > 0 ? blockerCodes.join(", ") : "none"}
FLAGGED (warning, user can override): ${warningCodes.length > 0 ? warningCodes.join(", ") : "none"}

If no relevant swap codes apply, return: { "appliedSwaps": [] }
`.trim();
}

// ─── Anthropic tool definition ────────────────────────────────────────────────
// FIX (Sam): previously the prompt only "asked" the model to respond in JSON.
// Using tool_use with tool_choice: {type: "tool"} makes the API return a
// guaranteed structured object — not a text block that might wrap in markdown.

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Returns the Anthropic tool definition for swap code output.
 * Pass as tools: [buildToolDefinition(dish)] plus
 * tool_choice: { type: "tool", name: "apply_swap_codes" }
 * in the API call.
 */
export function buildToolDefinition(dish: DishDNA): AnthropicTool {
  const relevantGuards = getGuardsForDish(dish);
  const validCodes = relevantGuards.map(g => g.code);

  return {
    name: "apply_swap_codes",
    description: `Apply only valid culinary swap codes for ${dish.displayName}. Do not invent codes.`,
    input_schema: {
      type: "object",
      properties: {
        appliedSwaps: {
          type: "array",
          description: "Swap codes to apply. Must be from the validCodes list only.",
          items: {
            type: "object",
            properties: {
              code: {
                type: "string",
                enum: validCodes.length > 0 ? validCodes : ["__no_swaps__"],
                description: "A valid swap code for this dish",
              },
              quantity: {
                type: "string",
                enum: ["trace", "minor", "significant", "dominant"],
                description: "Approximate proportion of the swap in the dish",
              },
            },
            required: ["code"],
          },
        },
        reasoning: {
          type: "string",
          description: "Brief explanation of why these swaps are being applied",
        },
      },
      required: ["appliedSwaps"],
    },
  };
}

// ─── Complete API call payload builder ───────────────────────────────────────

/**
 * Returns the full payload shape for an Anthropic API messages call
 * with constraint injection + forced tool use.
 *
 * Usage:
 *   const payload = buildAPIPayload(dish, userMessage);
 *   const response = await fetch("https://api.anthropic.com/v1/messages", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify(payload),
 *   });
 */
export function buildAPIPayload(dish: DishDNA, userMessage: string) {
  return {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: buildConstraintPromptFragment(dish),
    tools: [buildToolDefinition(dish)],
    tool_choice: { type: "tool", name: "apply_swap_codes" },
    messages: [
      { role: "user", content: userMessage },
    ],
  };
}

/**
 * Extracts the structured swap input from a raw Anthropic API response.
 * Returns null if the tool was not called (should not happen with tool_choice forced).
 */
export function extractSwapsFromResponse(
  responseContent: Array<{ type: string; name?: string; input?: unknown }>
): Array<{ code: string; quantity?: string }> | null {
  const toolUse = responseContent.find(
    block => block.type === "tool_use" && block.name === "apply_swap_codes"
  );
  if (!toolUse || typeof toolUse.input !== "object" || toolUse.input === null) {
    return null;
  }
  const input = toolUse.input as { appliedSwaps?: Array<{ code: string; quantity?: string }> };
  return input.appliedSwaps ?? [];
}
