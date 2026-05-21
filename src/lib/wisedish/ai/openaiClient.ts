import OpenAI from "openai";

export type OpenAiJsonResult =
  | { ok: true; content: string }
  | { ok: false; error: string; status?: number };

/**
 * Chat Completions with Structured Outputs (strict JSON Schema). Returns raw message content for parsing downstream.
 */
export async function completeOpenAiJson(args: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  responseFormat: OpenAI.ResponseFormatJSONSchema;
  maxTokens?: number;
  temperature?: number;
}): Promise<OpenAiJsonResult> {
  const client = new OpenAI({ apiKey: args.apiKey });
  const model = args.model;
  const apiKey = args.apiKey;
  try {
    console.log(
      "[generate] calling OpenAI | model:",
      model,
      "| key present:",
      !!apiKey,
      "| response_format:",
      args.responseFormat.type,
      "| schema:",
      args.responseFormat.json_schema.name
    );
    const res = await client.chat.completions.create({
      model: args.model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      response_format: args.responseFormat,
      max_tokens: args.maxTokens ?? 4000,
      temperature: args.temperature ?? 0.7,
    });
    const content = res.choices[0]?.message?.content ?? "";
    if (!content || content.trim() === "") {
      throw new Error("OpenAI returned empty content — possible model refusal or token limit hit");
    }
    console.log("[generate] OpenAI responded OK | usage:", res.usage);
    return { ok: true, content };
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("OpenAI returned empty content")) {
      throw e;
    }
    let message = "OpenAI request failed.";
    let status: number | undefined;
    if (e instanceof Error) message = e.message;
    if (typeof e === "object" && e && "status" in e) {
      const s = (e as { status?: unknown }).status;
      if (typeof s === "number") status = s;
    }
    return { ok: false, error: message, status };
  }
}

export type StreamOpenAiArgs = {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  responseFormat: OpenAI.ResponseFormatJSONSchema;
  maxTokens?: number;
  temperature?: number;
};

/**
 * Structured Outputs + streaming: yields content deltas from the assistant message.
 */
export async function* streamOpenAiStructuredCompletion(
  args: StreamOpenAiArgs
): AsyncGenerator<string, { usage?: unknown } | void, void> {
  const client = new OpenAI({ apiKey: args.apiKey });
  console.log(
    "[generate] streaming OpenAI | model:",
    args.model,
    "| key present:",
    !!args.apiKey,
    "| response_format:",
    args.responseFormat.type,
    "| schema:",
    args.responseFormat.json_schema.name
  );

  const stream = await client.chat.completions.create({
    model: args.model,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    response_format: args.responseFormat,
    max_tokens: args.maxTokens ?? 4000,
    temperature: args.temperature ?? 0.7,
    stream: true,
  });

  let usage: unknown;
  for await (const chunk of stream) {
    const u = (chunk as { usage?: unknown }).usage;
    if (u) usage = u;
    const delta = chunk.choices[0]?.delta?.content;
    if (typeof delta === "string" && delta.length > 0) {
      yield delta;
    }
  }
  if (usage !== undefined) console.log("[generate] OpenAI stream finished | usage:", usage);
  return usage !== undefined ? { usage } : undefined;
}
