import type { GenerateApiRequestBody } from "./apiContract";
import type { ProteinifyResponse, RecipeVersion } from "./types";
import {
  parseProteinifyResponseJson,
  parseRecipeVersion,
  type ParseResult,
} from "./parseResponse";

/**
 * Calls the local generation API (full run streams SSE; single-version regen returns JSON).
 */
const GENERATE_TIMEOUT_MS = 150_000;

function consumeSseBuffer(
  carry: string,
  chunk: string,
  onEvent: (event: string, data: string) => void
): string {
  const full = carry + chunk;
  const parts = full.split(/\r?\n\r?\n/);
  const incomplete = parts.pop() ?? "";
  for (const block of parts) {
    if (!block.trim()) continue;
    let eventName = "message";
    const dataLines: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length > 0) onEvent(eventName, dataLines.join("\n"));
  }
  return incomplete;
}

export type StreamFullOptions = {
  signal?: AbortSignal;
  onVersion?: (index: number, version: RecipeVersion) => void;
};

/**
 * Full generate (no `targetVersion`): reads SSE (`version` then `complete`).
 * Progressive `version` events may omit USDA enrichment; `complete` matches `ProteinifyResponse`.
 */
export async function streamGenerateFull(
  body: GenerateApiRequestBody,
  options: StreamFullOptions = {}
): Promise<ParseResult> {
  if (body.targetVersion) {
    return {
      ok: false,
      error: "streamGenerateFull does not support targetVersion — use postGenerate().",
    };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GENERATE_TIMEOUT_MS);
  const signal = options.signal;
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }

  let res: Response;
  try {
    res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return {
        ok: false,
        error:
          "Request timed out — generation can take 1–2 minutes. Try again or use PROTEINIFY_USE_MOCK=true for instant mock data.",
      };
    }
    return { ok: false, error: "Network error: could not reach /api/generate." };
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, error: `Request failed (${res.status})` };
    }
    const errObj = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
    const msg = typeof errObj?.error === "string" ? errObj.error : `Request failed (${res.status})`;
    return { ok: false, error: msg };
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/event-stream") || !res.body) {
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, error: "Expected SSE stream from /api/generate." };
    }
    return parseProteinifyResponseJson(json);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let carry = "";
  let finalResult: ParseResult | null = null;

  const dispatchSse = (ev: string, data: string) => {
    if (ev === "version") {
      try {
        const parsed = JSON.parse(data) as { index?: unknown; version?: unknown };
        const idx = parsed.index;
        if (typeof idx !== "number" || idx < 0 || idx > 2) return;
        const v = parseRecipeVersion(parsed.version);
        if (v) options.onVersion?.(idx, v);
      } catch {
        /* ignore malformed chunk */
      }
    } else if (ev === "complete") {
      try {
        finalResult = parseProteinifyResponseJson(JSON.parse(data));
      } catch {
        finalResult = { ok: false, error: "Invalid complete payload from server." };
      }
    } else if (ev === "error") {
      try {
        const o = JSON.parse(data) as { message?: unknown };
        finalResult = {
          ok: false,
          error: typeof o.message === "string" ? o.message : "Generation failed.",
        };
      } catch {
        finalResult = { ok: false, error: "Generation failed." };
      }
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      carry = consumeSseBuffer(carry, decoder.decode(value, { stream: true }), dispatchSse);
    }
    carry = consumeSseBuffer(carry, decoder.decode(), dispatchSse);
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return {
        ok: false,
        error:
          "Request timed out — generation can take 1–2 minutes. Try again or use PROTEINIFY_USE_MOCK=true for instant mock data.",
      };
    }
    return { ok: false, error: "Failed to read generation stream." };
  }

  if (finalResult) return finalResult;
  return { ok: false, error: "Stream ended before a complete result." };
}

export async function postGenerate(body: GenerateApiRequestBody): Promise<ParseResult> {
  if (!body.targetVersion) {
    return streamGenerateFull(body);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GENERATE_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return {
        ok: false,
        error:
          "Request timed out — generation can take 1–2 minutes. Try again or use PROTEINIFY_USE_MOCK=true for instant mock data.",
      };
    }
    return { ok: false, error: "Network error: could not reach /api/generate." };
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    return { ok: false, error: "Server returned non-JSON." };
  }

  if (!res.ok) {
    const errObj = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
    const msg = typeof errObj?.error === "string" ? errObj.error : `Request failed (${res.status})`;
    return { ok: false, error: msg };
  }

  return parseProteinifyResponseJson(json);
}
