import { getApiRequestEndpointCandidates, withApiBase } from "../apiBaseUrl";

export const IMPORT_ENDPOINT = withApiBase("/api/import");

function getImportEndpointCandidates(): string[] {
  return getApiRequestEndpointCandidates("/api/import");
}

function shouldRetryImport(status: number, hasAnotherCandidate: boolean): boolean {
  if (!hasAnotherCandidate) return false;
  return status === 401 || status === 403 || status === 404;
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
    const candidates = getImportEndpointCandidates();
    let res: Response | null = null;
    let endpointUsed = candidates[0] ?? IMPORT_ENDPOINT;
    for (let i = 0; i < candidates.length; i++) {
      const endpoint = candidates[i];
      endpointUsed = endpoint;
      try {
        const candidate = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const hasAnother = i < candidates.length - 1;
        if (shouldRetryImport(candidate.status, hasAnother)) {
          continue;
        }
        res = candidate;
        break;
      } catch {
        // try next endpoint
      }
    }
    if (!res) {
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
