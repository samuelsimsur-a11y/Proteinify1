import {
  getApiRequestEndpointCandidates,
  isLikelyOffline,
  markApiEndpointSuccess,
  withApiBase,
} from "../apiBaseUrl";

export const IMPORT_ENDPOINT = withApiBase("/api/import");
const IMPORT_TIMEOUT_MS = 45_000;

function getImportEndpointCandidates(): string[] {
  return getApiRequestEndpointCandidates("/api/import");
}

function shouldRetryImport(status: number, hasAnotherCandidate: boolean): boolean {
  if (!hasAnotherCandidate) return false;
  return status === 408 || status === 429 || status >= 500;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchImportWithRetry(endpoint: string, init: RequestInit, retries: number): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(endpoint, init);
    } catch (err) {
      lastErr = err;
      if (attempt >= retries) break;
      await wait(450 * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("network");
}

export type ImportResponse =
  | {
      foundRecipe: true;
      dishName: string;
      ingredients: string[];
      instructions: string[];
      source: "youtube" | "tiktok";
      confidence: "high" | "medium" | "low";
      originalTitle: string;
    }
  | {
      foundRecipe: false;
      message: string;
      source: "youtube" | "tiktok";
      confidence: "high" | "medium" | "low";
      originalTitle: string;
    };

export async function importRecipeFromUrl(url: string): Promise<
  | { ok: true; data: ImportResponse }
  | { ok: false; error: string }
> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), IMPORT_TIMEOUT_MS);
    const candidates = getImportEndpointCandidates();
    let res: Response | null = null;
    let endpointUsed = candidates[0] ?? IMPORT_ENDPOINT;
    try {
      for (let i = 0; i < candidates.length; i++) {
        const endpoint = candidates[i];
        endpointUsed = endpoint;
        try {
          const candidate = await fetchImportWithRetry(
            endpoint,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url }),
              signal: ctrl.signal,
            },
            1
          );
          const hasAnother = i < candidates.length - 1;
          if (shouldRetryImport(candidate.status, hasAnother)) {
            continue;
          }
          res = candidate;
          markApiEndpointSuccess(endpoint);
          break;
        } catch {
          // try next endpoint
        }
      }
    } finally {
      clearTimeout(timer);
    }
    if (!res) {
      if (ctrl.signal.aborted) {
        return { ok: false, error: "Request timed out while importing. Please try again." };
      }
      if (isLikelyOffline()) {
        return { ok: false, error: "No internet connection detected. Reconnect and try again." };
      }
      return {
        ok: false,
        error: `Could not reach any import endpoint (${candidates.join(", ")}).`,
      };
    }
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, error: `Import endpoint returned invalid JSON (${endpointUsed}).` };
    }
    if (!res.ok) {
      const msg =
        json && typeof json === "object" && typeof (json as { error?: unknown }).error === "string"
          ? `${(json as { error: string }).error} [${res.status}] @ ${endpointUsed}`
          : `Import failed (${res.status}) at ${endpointUsed}`;
      return { ok: false, error: msg };
    }
    return { ok: true, data: json as ImportResponse };
  } catch {
    return { ok: false, error: `Could not reach ${IMPORT_ENDPOINT}.` };
  }
}
