"use client";

import { useEffect, useState } from "react";
import type { RecipeVersion } from "@/lib/wisedish/types";
import { resolveProductionOrigin } from "@/lib/wisedish/productionOrigin";
import { isCapacitorNative } from "@/lib/capacitorEnv";
import { track } from "@/lib/analytics";

type Props = {
  dish: string;
  version: RecipeVersion;
  label: string;
};

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildShareText(dish: string, version: RecipeVersion, label: string): string {
  const total = Math.round(version.totalProteinG ?? version.macros.p);
  const before = Math.max(0, Math.round(total - version.macros.d));
  const delta = total - before;
  return [
    `I upgraded my ${titleCase(dish)} with Wise Dish 🍽️`,
    `${label}: ${before}g → ${total}g protein per serving${delta > 0 ? ` (+${delta}g)` : ""}.`,
    `Same dish, more protein — try yours: ${resolveProductionOrigin()}`,
  ].join("\n");
}

export default function ShareButton({ dish, version, label }: Props) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const share = async () => {
    const text = buildShareText(dish, version, label);
    const title = `${titleCase(dish)} — ${label}`;
    try {
      if (isCapacitorNative()) {
        const { Share } = await import("@capacitor/share");
        await Share.share({ title, text, dialogTitle: "Share your upgraded dish" });
        track("recipe_shared", { method: "native", tier: version.id });
        return;
      }
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title, text });
        track("recipe_shared", { method: "web-share", tier: version.id });
        return;
      }
    } catch (err) {
      // User closed the share sheet — not an error worth surfacing.
      if (err instanceof Error && /cancel|abort/i.test(`${err.name} ${err.message}`)) return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied — paste it anywhere to share");
      track("recipe_shared", { method: "clipboard", tier: version.id });
    } catch {
      setToast("Couldn't open sharing on this device");
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void share()}
        className="min-h-11 rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-primary)] transition hover:bg-[color:var(--accent-light)]"
      >
        Share
      </button>
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-4 py-2 text-xs font-semibold text-[color:var(--text-primary)] shadow-lg"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
