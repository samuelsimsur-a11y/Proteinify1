export type GenerationMode =
  | { mode: "mock" }
  | { mode: "openai"; apiKey: string; model: string }
  | { mode: "error"; message: string };

/**
 * `PROTEINIFY_USE_MOCK=true` — use local mock (no API key).
 * Otherwise `OPENAI_API_KEY` is required. Optional: `OPENAI_MODEL`, `PROTEINIFY_AI_PROVIDER` (only `openai` supported).
 */
export function getGenerationMode(): GenerationMode {
  if (process.env.PROTEINIFY_USE_MOCK === "true") {
    return { mode: "mock" };
  }

  const provider = (process.env.PROTEINIFY_AI_PROVIDER ?? "openai").trim().toLowerCase();
  if (provider !== "openai") {
    return {
      mode: "error",
      message: `Unsupported PROTEINIFY_AI_PROVIDER "${process.env.PROTEINIFY_AI_PROVIDER}". Only "openai" is implemented.`,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      return { mode: "mock" };
    }
    return {
      mode: "error",
      message:
        "OPENAI_API_KEY is not set. Add it to your environment, or set PROTEINIFY_USE_MOCK=true.",
    };
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  return { mode: "openai", apiKey, model };
}
