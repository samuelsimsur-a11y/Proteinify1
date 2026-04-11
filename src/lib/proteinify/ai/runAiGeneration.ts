import type { GenerateApiRequestBody } from "@/lib/proteinify/apiContract";
import type { ProteinifyResponse } from "@/lib/proteinify/types";
import {
  proteinifyCompactFullResponseFormat,
  proteinifyCompactSingleVersionResponseFormat,
} from "./compactSchema";
import { buildFullGeneratePrompt, buildSingleVersionRegeneratePrompt } from "./prompts";
import { completeOpenAiJson } from "./openaiClient";
import {
  mergeSingleCompactVersion,
  parseExpandAndValidateProteinify,
} from "@/lib/proteinify/expander/expandRecipe";
import { parseModelJsonOutput } from "@/lib/proteinify/parseResponse";

export type AiGenerationResult =
  | { ok: true; data: ProteinifyResponse }
  | { ok: false; code: "AI_REQUEST" | "AI_JSON" | "AI_SCHEMA"; error: string; details?: unknown };

export async function runFullAiGeneration(args: {
  body: GenerateApiRequestBody;
  apiKey: string;
  model: string;
  maxTokens: number;
}): Promise<AiGenerationResult> {
  const { system, user } = buildFullGeneratePrompt(args.body);
  const ai = await completeOpenAiJson({
    apiKey: args.apiKey,
    model: args.model,
    system,
    user,
    responseFormat: proteinifyCompactFullResponseFormat,
    maxTokens: args.maxTokens,
    temperature: 0.7,
  });
  if (!ai.ok) {
    return { ok: false, code: "AI_REQUEST", error: ai.error, details: { status: ai.status } };
  }

  const parsedText = parseModelJsonOutput(ai.content);
  if (!parsedText.ok) {
    return { ok: false, code: "AI_JSON", error: parsedText.error, details: { snippet: ai.content.slice(0, 400) } };
  }

  const tmode = args.body.transformationMode ?? "proteinify";
  const validated = parseExpandAndValidateProteinify(parsedText.value, tmode);
  if (!validated.ok) {
    return {
      ok: false,
      code: "AI_SCHEMA",
      error: validated.error,
      details: parsedText.value,
    };
  }

  return { ok: true, data: validated.data };
}

export async function runSingleVersionAiGeneration(args: {
  body: GenerateApiRequestBody;
  previous: ProteinifyResponse;
  apiKey: string;
  model: string;
  maxTokens: number;
}): Promise<AiGenerationResult> {
  const tv = args.body.targetVersion;
  if (!tv) {
    return { ok: false, code: "AI_SCHEMA", error: "targetVersion missing for single-version AI run." };
  }

  const { system, user } = buildSingleVersionRegeneratePrompt(args.body, args.previous, tv);
  const ai = await completeOpenAiJson({
    apiKey: args.apiKey,
    model: args.model,
    system,
    user,
    responseFormat: proteinifyCompactSingleVersionResponseFormat,
    maxTokens: args.maxTokens,
    temperature: 0.7,
  });
  if (!ai.ok) {
    return { ok: false, code: "AI_REQUEST", error: ai.error, details: { status: ai.status } };
  }

  const parsedText = parseModelJsonOutput(ai.content);
  if (!parsedText.ok) {
    return { ok: false, code: "AI_JSON", error: parsedText.error, details: { snippet: ai.content.slice(0, 400) } };
  }

  const tmode = args.body.transformationMode ?? "proteinify";
  const validated = mergeSingleCompactVersion(parsedText.value, tv, args.previous, tmode);
  if (!validated.ok) {
    return { ok: false, code: "AI_SCHEMA", error: validated.error, details: parsedText.value };
  }

  return { ok: true, data: validated.data };
}
