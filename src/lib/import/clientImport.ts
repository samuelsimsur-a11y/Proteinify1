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
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, error: "Import endpoint returned invalid JSON." };
    }
    if (!res.ok) {
      const msg =
        json && typeof json === "object" && typeof (json as { error?: unknown }).error === "string"
          ? (json as { error: string }).error
          : `Import failed (${res.status})`;
      return { ok: false, error: msg };
    }
    return { ok: true, data: json as ImportResponse };
  } catch {
    return { ok: false, error: "Could not reach /api/import." };
  }
}
