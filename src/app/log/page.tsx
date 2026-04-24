"use client";

import { useEffect, useMemo, useState } from "react";
import {
  clearAllRecipes,
  deleteRecipe,
  getSavedRecipes,
  initRecipeLogNativeStorage,
  RECIPE_LOG_EVENT,
  setSelectedRecipeId,
  type SavedRecipe,
} from "@/lib/recipeLog";
import { getAppRouteHref } from "@/lib/navigation/appRoutes";

function getRelativeTime(timestamp: number): string {
  const deltaMs = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  if (deltaMs < minute) return "Just now";
  if (deltaMs < hour) return `${Math.max(1, Math.floor(deltaMs / minute))} minutes ago`;
  if (deltaMs < day) return `${Math.max(1, Math.floor(deltaMs / hour))} hours ago`;
  if (deltaMs < 2 * day) return "Yesterday";
  if (deltaMs < week) return `${Math.floor(deltaMs / day)} days ago`;
  return `${Math.floor(deltaMs / week)} weeks ago`;
}

function modeLabel(mode: string): string {
  return mode === "lean" ? "Lean" : "Wise Dish";
}

function sourceLabel(source?: SavedRecipe["source"]): string | null {
  if (!source || source === "typed") return null;
  if (source === "youtube") return "From YouTube";
  if (source === "tiktok") return "From TikTok";
  return "From text";
}

export default function LogPage() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);

  const refresh = () => setRecipes(getSavedRecipes());
  useEffect(() => {
    const doRefresh = () => refresh();
    void initRecipeLogNativeStorage().then(doRefresh);
    window.addEventListener(RECIPE_LOG_EVENT, doRefresh);
    window.addEventListener("storage", doRefresh);
    return () => {
      window.removeEventListener(RECIPE_LOG_EVENT, doRefresh);
      window.removeEventListener("storage", doRefresh);
    };
  }, []);

  const hasRecipes = recipes.length > 0;
  const countText = useMemo(() => `${recipes.length} saved`, [recipes.length]);
  const homeHref = getAppRouteHref("home");

  return (
    <section className="px-4 py-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              window.location.href = homeHref;
            }}
            className="min-h-11 rounded-xl border border-[color:var(--divider)] px-3 text-sm text-[color:var(--text-primary)]"
          >
            ←
          </button>
          <div className="text-center">
            <h1 className="font-display text-lg font-semibold text-[color:var(--text-primary)]">My recipes</h1>
            <p className="text-[11px] text-[color:var(--text-muted)]">{countText}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!hasRecipes) return;
              if (!window.confirm("Clear all saved recipes?")) return;
              clearAllRecipes();
              refresh();
            }}
            className="min-h-11 rounded-xl border border-[color:var(--divider)] px-3 text-sm text-[color:var(--text-primary)] disabled:opacity-40"
            disabled={!hasRecipes}
            aria-label="Clear all recipes"
          >
            🗑
          </button>
        </div>

        {!hasRecipes ? (
          <div className="pf-card mt-8 p-8 text-center">
            <div className="font-display text-base font-semibold text-[color:var(--text-primary)]">No saved recipes yet</div>
            <div className="mt-2 text-sm text-[color:var(--text-muted)]">Generate a dish and it saves automatically</div>
          </div>
        ) : (
          <div className="space-y-3">
            {recipes.map((recipe) => {
              const close = recipe.versions?.[0]?.macros?.d;
              const full = recipe.versions?.[2]?.macros?.d;
              return (
                <div key={recipe.id} className="pf-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRecipeId(recipe.id);
                        window.location.href = homeHref;
                      }}
                      className="min-h-11 flex-1 text-left"
                    >
                      <div className="text-lg font-semibold text-[color:var(--text-primary)]">{recipe.displayName}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[color:var(--divider)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--text-muted)]">
                          {modeLabel(recipe.mode)}
                        </span>
                        {sourceLabel(recipe.source) ? (
                          <span className="rounded-full border border-[color:var(--divider)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--text-muted)]">
                            {sourceLabel(recipe.source)}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 text-xs text-[color:var(--text-muted)]">
                        Close Match +{Number(close ?? 0)}g → Full Send +{Number(full ?? 0)}g
                      </div>
                      <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">Saved {getRelativeTime(recipe.savedAt)}</div>
                      <div className="mt-2 text-[11px] font-semibold text-[color:var(--accent)]">Tap to open →</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteRecipe(recipe.id);
                        refresh();
                      }}
                      className="min-h-11 min-w-11 rounded-xl border border-[color:var(--divider)] px-3 text-sm text-[color:var(--text-muted)]"
                      aria-label={`Delete ${recipe.displayName}`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

