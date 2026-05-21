import type { GenerateApiRequestBody } from "@/lib/wisedish/apiContract";
import type { WiseDishResponse } from "@/lib/wisedish/types";
import {
  wisedishCompactFullResponseFormat,
  wisedishCompactSingleVersionResponseFormat,
} from "./compactSchema";
import { buildFullGeneratePrompt, buildSingleVersionRegeneratePrompt } from "./prompts";
import { completeOpenAiJson } from "./openaiClient";
import {
  mergeSingleCompactVersion,
  parseExpandAndValidateWiseDish,
} from "@/lib/wisedish/expander/expandRecipe";
import { isParseFailure, isParseSuccess, parseModelJsonOutput } from "@/lib/wisedish/parseResponse";

export type AiGenerationResult =
  | { ok: true; data: WiseDishResponse }
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
    responseFormat: wisedishCompactFullResponseFormat,
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

  const tmode = args.body.transformationMode ?? "wisedish";
  const validated = parseExpandAndValidateWiseDish(parsedText.value, tmode);
  if (isParseFailure(validated)) {
    return {
      ok: false,
      code: "AI_SCHEMA",
      error: validated.error,
      details: parsedText.value,
    };
  }
  if (!isParseSuccess(validated)) {
    return { ok: false, code: "AI_SCHEMA", error: "Disambiguation is not supported in this code path." };
  }

  return { ok: true, data: validated.data };
}

export async function runSingleVersionAiGeneration(args: {
  body: GenerateApiRequestBody;
  previous: WiseDishResponse;
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
    responseFormat: wisedishCompactSingleVersionResponseFormat,
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

  const tmode = args.body.transformationMode ?? "wisedish";
  const validated = mergeSingleCompactVersion(parsedText.value, tv, args.previous, tmode);
  if (isParseFailure(validated)) {
    return { ok: false, code: "AI_SCHEMA", error: validated.error, details: parsedText.value };
  }
  if (!isParseSuccess(validated)) {
    return { ok: false, code: "AI_SCHEMA", error: "Disambiguation is not supported in this code path." };
  }

  return { ok: true, data: validated.data };
}
