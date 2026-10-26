import { describe, expect, it } from "vitest";
import { buildSingleTierSwapSchema, patchCompactWiseDishSchema } from "./compactSchemaPatch";
import { getWisedishSchema } from "@/lib/culinary/dil/loadWisedishSchema";

type Node = Record<string, unknown>;

/** OpenAI strict structured outputs: every object lists all its properties as required and forbids extras. */
function strictViolations(node: unknown, path = "$"): string[] {
  if (!node || typeof node !== "object") return [];
  const n = node as Node;
  const out: string[] = [];
  const types = Array.isArray(n.type) ? n.type : [n.type];
  if (types.includes("object")) {
    const props = Object.keys((n.properties as Node) ?? {});
    const required = new Set((n.required as string[]) ?? []);
    if (n.additionalProperties !== false) out.push(`${path}: additionalProperties must be false`);
    for (const p of props) if (!required.has(p)) out.push(`${path}.${p}: not in required`);
    for (const r of required) if (!props.includes(r)) out.push(`${path}: required "${r}" has no property`);
    for (const [k, v] of Object.entries((n.properties as Node) ?? {})) out.push(...strictViolations(v, `${path}.${k}`));
  }
  if (n.items) out.push(...strictViolations(n.items, `${path}[]`));
  return out;
}

describe("structured output schemas", () => {
  it("patched generate schema is strict-mode valid and asks for calories", () => {
    const patched = patchCompactWiseDishSchema(getWisedishSchema()) as { strict: boolean; schema: Node };
    expect(patched.strict).toBe(true);
    expect(strictViolations(patched.schema)).toEqual([]);
    const props = patched.schema.properties as Node;
    const tierProps = ((props.versions as Node).items as Node).properties as Node;
    expect(tierProps.caloriesPerServing).toBeTruthy();
    expect(((props.sharedRecipe as Node).properties as Node).originalCaloriesPerServing).toBeTruthy();
  });

  it("single-tier swap schema is strict-mode valid", () => {
    const swap = buildSingleTierSwapSchema() as { strict: boolean; schema: Node };
    expect(swap.strict).toBe(true);
    expect(strictViolations(swap.schema)).toEqual([]);
  });

  it("does not mutate the shared base schema", () => {
    const before = JSON.stringify(getWisedishSchema());
    patchCompactWiseDishSchema(getWisedishSchema());
    expect(JSON.stringify(getWisedishSchema())).toBe(before);
  });
});
