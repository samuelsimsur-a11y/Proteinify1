import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getServerEnv } from "@/lib/config/env";
import { getClientIp } from "@/lib/rateLimit/generateRouteRateLimit";
import { checkImportRateLimit } from "@/lib/rateLimit/importRouteRateLimit";
import { extractYouTubeVideoId, fetchYouTubeDescription } from "@/lib/import/youtube";
import { fetchTikTokCaption, isTikTokUrl } from "@/lib/import/tiktok";
import { API_CORS_HEADERS, withCorsHeaders } from "@/lib/http/cors";

type Confidence = "high" | "medium" | "low";
type Source = "youtube" | "tiktok";

const OPENAI_IMPORT_TIMEOUT_MS = 45_000;
const OPENAI_IMPORT_MAX_ATTEMPTS = 2;

function requestIdFrom(req: NextRequest): string {
  return req.headers.get("x-request-id")?.trim() || crypto.randomUUID();
}

function jsonResponse(body: unknown, requestId: string, init?: ResponseInit): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: withCorsHeaders({ "X-Request-Id": requestId, ...(init?.headers ?? {}) }),
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: API_CORS_HEADERS,
  });
}

type ImportSuccess = {
  foundRecipe: true;
  dishName: string;
  ingredients: string[];
  instructions: string[];
  source: Source;
  confidence: Confidence;
  originalTitle: string;
};

type ImportNoRecipe = {
  foundRecipe: false;
  message: string;
  source: Source;
  originalTitle: string;
  confidence: Confidence;
};

function titleToDishGuess(title: string): string {
  const cleaned = title
    .replace(/[#@][\w-]+/g, " ")
    .replace(/\b(recipe|easy|shorts?|viral|asmr|how to|tutorial|quick)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 90);
}

function extractIngredientLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => /^[-*•\d.)]/.test(line) || /\b(cup|tsp|tbsp|g|kg|ml|oz|lb)\b/i.test(line))
    .slice(0, 30);
}

function extractInstructionLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => /^(step\s*\d+|\d+[.)])\s*/i.test(line))
    .slice(0, 30);
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function sanitizeList(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableOpenAiError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const status = (error as { status?: unknown }).status;
  if (typeof status === "number") return status === 429 || status >= 500;
  const msg = error.message.toLowerCase();
  return msg.includes("timeout") || msg.includes("network");
}

async function runExtractionPrompt(prompt: string): Promise<Record<string, unknown> | null> {
  const { OPENAI_API_KEY } = getServerEnv();
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  let completion: OpenAI.Chat.Completions.ChatCompletion | null = null;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= OPENAI_IMPORT_MAX_ATTEMPTS; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), OPENAI_IMPORT_TIMEOUT_MS);
    try {
      completion = await openai.chat.completions.create(
        {
          model: "gpt-4.1-mini",
          temperature: 0.1,
          max_completion_tokens: 1200,
          messages: [
            { role: "system", content: "You extract structured recipe data. Return JSON only." },
            { role: "user", content: prompt },
          ],
        },
        { signal: ctrl.signal }
      );
      break;
    } catch (err) {
      lastErr = err;
      const shouldRetry = (ctrl.signal.aborted || isRetryableOpenAiError(err)) && attempt < OPENAI_IMPORT_MAX_ATTEMPTS;
      if (!shouldRetry) break;
      await sleep(250 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  if (!completion) {
    throw (lastErr instanceof Error ? lastErr : new Error("OpenAI extraction failed"));
  }
  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) return null;
  const jsonText = extractJsonObject(raw) ?? raw;
  try {
    const parsed = JSON.parse(jsonText);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function toImportSuccess(
  source: Source,
  originalTitle: string,
  parsed: Record<string, unknown>
): ImportSuccess | ImportNoRecipe {
  const foundRecipe = parsed.foundRecipe === true;
  if (!foundRecipe) {
    return {
      foundRecipe: false,
      message: "No recipe found in this source.",
      source,
      originalTitle,
      confidence: "low",
    };
  }

  const dishName = typeof parsed.dishName === "string" ? parsed.dishName.trim() : "";
  const ingredients = sanitizeList(parsed.ingredients);
  const instructions = sanitizeList(parsed.instructions);
  const confidenceRaw = parsed.confidence;
  const confidence: Confidence =
    confidenceRaw === "high" || confidenceRaw === "medium" || confidenceRaw === "low"
      ? confidenceRaw
      : source === "youtube"
        ? "high"
        : "medium";

  if (!dishName) {
    return {
      foundRecipe: false,
      message: "Could not determine dish name from this source.",
      source,
      originalTitle,
      confidence: "low",
    };
  }

  return {
    foundRecipe: true,
    dishName,
    ingredients,
    instructions,
    source,
    confidence,
    originalTitle,
  };
}

function fallbackImport(
  source: Source,
  originalTitle: string,
  text: string
): ImportNoRecipe {
  const dishName = titleToDishGuess(originalTitle) || (source === "youtube" ? "YouTube recipe" : "TikTok recipe");
  const ingredients = extractIngredientLines(text);
  const instructions = extractInstructionLines(text);
  return {
    foundRecipe: false,
    message: `Could not confidently extract a full recipe for "${dishName}". Please review and edit inputs.`,
    source,
    confidence: "low",
    originalTitle,
  };
}

export async function POST(req: NextRequest) {
  const requestId = requestIdFrom(req);
  const ip = getClientIp(req);
  const limited = checkImportRateLimit(ip);
  if (!limited.ok) {
    return jsonResponse(
      { error: "Too many requests — try again in a few minutes.", code: "RATE_LIMITED" },
      requestId,
      { status: 429 }
    );
  }

  try {
    getServerEnv();
    const body = (await req.json()) as { url?: unknown };
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) {
      return jsonResponse({ error: "Missing URL.", code: "INVALID_REQUEST" }, requestId, { status: 400 });
    }

    const ytId = extractYouTubeVideoId(url);
    if (ytId) {
      const yt = await fetchYouTubeDescription(ytId);
      if (!yt) {
        return jsonResponse({ error: "YouTube video not found.", code: "NOT_FOUND" }, requestId, { status: 404 });
      }

      const prompt = `Extract the recipe from this YouTube video description.
Return JSON only with this structure:
{
  "dishName": "the name of the dish",
  "ingredients": ["ingredient 1 with amount", "ingredient 2 with amount"],
  "instructions": ["step 1", "step 2"],
  "foundRecipe": true or false
}

If no recipe is found in the description, return { "foundRecipe": false }

Video title: ${yt.title}
Video description: ${yt.description}`;

      const parsed = await runExtractionPrompt(prompt);
      if (!parsed) {
        return jsonResponse(fallbackImport("youtube", yt.title, yt.description), requestId);
      }
      const normalized = toImportSuccess("youtube", yt.title, parsed);
      if (!normalized.foundRecipe) {
        return jsonResponse(fallbackImport("youtube", yt.title, yt.description), requestId);
      }
      return jsonResponse(normalized, requestId);
    }

    if (isTikTokUrl(url)) {
      const tk = await fetchTikTokCaption(url);
      if (!tk) {
        return jsonResponse({ error: "TikTok video not found.", code: "NOT_FOUND" }, requestId, { status: 404 });
      }

      const prompt = `Extract any recipe information from this TikTok caption.
Return JSON only:
{
  "dishName": "best guess at dish name",
  "ingredients": ["ingredient with amount if present"],
  "instructions": ["step if present"],
  "confidence": "high" | "medium" | "low",
  "foundRecipe": true or false
}

If the caption is short or vague, make a best guess at the dish name
from whatever text is available. Set confidence to "low" if guessing.

Caption: ${tk.caption}`;

      const parsed = await runExtractionPrompt(prompt);
      if (!parsed) {
        return jsonResponse(fallbackImport("tiktok", tk.caption, tk.caption), requestId);
      }
      const normalized = toImportSuccess("tiktok", tk.caption, parsed);
      if (!normalized.foundRecipe) {
        return jsonResponse(fallbackImport("tiktok", tk.caption, tk.caption), requestId);
      }
      // Keep TikTok resilient: even if AI finds only a dish guess, we still proceed.
      return jsonResponse({
        ...normalized,
        ingredients: normalized.ingredients.slice(0, 30),
        instructions: normalized.instructions.slice(0, 30),
      }, requestId);
    }

    return jsonResponse(
      { error: "Unsupported URL. Paste a TikTok or YouTube link.", code: "UNSUPPORTED_URL" },
      requestId,
      { status: 400 }
    );
  } catch (err) {
    console.error("[import] unhandled error:", err);
    return jsonResponse({ error: "Internal server error", code: "INTERNAL_ERROR" }, requestId, { status: 500 });
  }
}
