// src/lib/culinary/dil/promptBuilder.ts
// FIX: guard codes are derived from the loader index — never hardcoded.
// FIX: exports a buildToolDefinition() for Anthropic tool_use API so the
//      LLM is structurally forced to return valid swap codes, not free text.

import type { DishDNA, SwapGuard } from "./schemas";
import { getGuardsForDish } from "./loader";

// ─── Constraint prompt fragment ───────────────────────────────────────────────

function summarizePhysics(dish: DishDNA): string {
  const p = dish.physicsConstraints;
  const bits: string[] = [];
  if (p.moistureSensitive) bits.push("moisture-sensitive (no free-water / steam-breaking hacks)");
  if (p.heatTransferCritical) bits.push("heat-transfer matters for protein texture");
  if (p.acidTimingSensitive) bits.push("acid timing changes outcome — respect stages");
  return bits.length > 0 ? bits.join("; ") : "none flagged";
}

/**
 * Builds the constraint block injected into the system prompt.
 * Uses compact summaries of DishDNA fields the model needs for identity and texture;
 * does NOT dump the entire JSON (token budget), but prefers **quality** over aggressive stripping.
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
    .map(arc => {
      const merge = arc.mergeAt ? ` →@${arc.mergeAt}` : "";
      const note = arc.notes ? ` (${arc.notes.slice(0, 120)}${arc.notes.length > 120 ? "…" : ""})` : "";
      return `${arc.track}: ${arc.sequence.join(" → ")}${merge}${note}`;
    })
    .join(" | ");

  const absentItems = dish.historicallyAbsent
    .filter(h => h.confidence === "definitive")
    .map(h => h.item)
    .join(", ");

  const contestedAbsent = dish.historicallyAbsent
    .filter(h => h.confidence === "contested" || h.confidence === "regional")
    .slice(0, 2)
    .map(h => h.item)
    .join(", ");

  const nonnegot = dish.keyNonnegotiables;
  const nonnegotLine =
    nonnegot.length <= 6
      ? nonnegot.join("; ")
      : `${nonnegot.slice(0, 6).join("; ")} (+${nonnegot.length - 6} more in data)`;

  const fatLine = dish.fatVehicle
    .slice(0, 5)
    .map(f => `${f.stage}: ${f.name} (${f.role}, ${f.thermalPoint})`)
    .join(" | ");

  const acidLine = dish.acidAnchor
    .slice(0, 3)
    .map(
      a =>
        `${a.ingredient} @${a.stage} as ${a.role}` +
        (a.contactTimeMinutes != null ? ` ~${a.contactTimeMinutes}m` : "")
    )
    .join(" | ");

  const tc = dish.textureContrast;
  const textureContrastLine = `${tc.primary.component}=${tc.primary.texture} vs ${tc.secondary.component}=${tc.secondary.texture} — preserve which component carries which mouthfeel.`;

  const anchors = dish.structuralAnchors.slice(0, 4).join("; ");
  const confusion = dish.confusionRisks.slice(0, 3).join("; ");

  return `
## CULINARY GRAMMAR CONSTRAINTS — ${dish.displayName.toUpperCase()}
Zone: ${dish.cuisineZone} | transformation class: ${dish.transformationClass}
Identity method: ${dish.identityMethod} | identity protein: ${dish.identityProtein ?? "unspecified"}
Cooking arcs: ${arcSummary}
Fat / flavor vehicles (stage-aware): ${fatLine || "none listed"}
Acid anchors: ${acidLine || "none listed"}
Aromatic backbone (summary): ${dish.aromaticBase.slice(0, 4).join("; ") || "none listed"}
Texture profile: ${dish.textureProfile.join(", ") || "n/a"}
Texture contrast: ${textureContrastLine}
Physics: ${summarizePhysics(dish)}
Structural anchors: ${anchors || "none listed"}
Non-negotiables: ${nonnegotLine}
Structurally absent (definitive — do not introduce as authentic): ${absentItems || "none specified"}
Absent / contested (treat carefully; do not assert as traditional): ${contestedAbsent || "none listed"}
Common confusion risks: ${confusion || "none listed"}

## SWAP CODE CONTRACT
Populate **appliedSwapCodes** on each tier in the main JSON output using only the valid codes below.
Do not invent codes. Do not use ad-hoc swap labels where a listed code exists for this dish.

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
