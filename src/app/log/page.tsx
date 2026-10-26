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
import {
  COOK_LOG_EVENT,
  PROTEIN_MILESTONES_G,
  computeStats,
  getCookLog,
  initCookLogNativeStorage,
  type CookEntry,
} from "@/lib/cookLog";

function signed(n: number): string {
  const r = Math.round(n);
  return r >= 0 ? `+${r}g` : `${r}g`;
}

const RATING_EMOJI: Record<number, string> = { 2: "🔥", 1: "👍", 0: "😐", [-1]: "👎" };

function ProteinBankCard({ entries }: { entries: CookEntry[] }) {
  const stats = computeStats(entries);
  if (stats.dishesCooked === 0) {
    return (
      <div className="pf-card mb-4 p-4">
        <div className="font-display text-base font-bold text-[color:var(--text-primary)]">🏦 Protein Bank</div>
        <p className="mt-1 text-xs text-[color:var(--text-muted)]">
          Cook a version and tap “I cooked this” — the protein you added gets banked here. First badge at{" "}
          {PROTEIN_MILESTONES_G[0]}g.
        </p>
      </div>
    );
  }
  const prev = stats.lastMilestoneG ?? 0;
  const next = stats.nextMilestoneG;
  const pct = next ? Math.min(100, Math.round(((stats.totalAddedG - prev) / (next - prev)) * 100)) : 100;
  const recent = [...entries].sort((a, b) => b.cookedAt - a.cookedAt).slice(0, 5);
  return (
    <div className="pf-card mb-4 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-display text-base font-bold text-[color:var(--text-primary)]">🏦 Protein Bank</div>
        <div className="font-display text-2xl font-extrabold tabular-nums text-[color:var(--text-primary)]">
          {stats.totalAddedG}g
        </div>
      </div>
      <div className="mt-1 text-xs text-[color:var(--text-muted)]">
        Extra protein from {stats.dishesCooked} cooked dish{stats.dishesCooked === 1 ? "" : "es"}
        {stats.weekStreak > 0 ? ` · 🔥 ${stats.weekStreak}-week cooking streak` : ""}
      </div>
      {next ? (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--surface-offset)]" aria-hidden>
            <div className="h-full rounded-full bg-[color:var(--accent)]" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
            {next - stats.totalAddedG}g to your {next}g badge
          </div>
        </div>
      ) : (
        <div className="mt-2 text-[11px] font-semibold text-[color:var(--text-primary)]">🏆 Every badge unlocked</div>
      )}
      {stats.lastMilestoneG ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PROTEIN_MILESTONES_G.filter((m) => m <= stats.totalAddedG).map((m) => (
            <span
              key={m}
              className="rounded-full border border-[color:var(--accent)]/60 bg-[color:var(--accent-light)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--text-primary)]"
            >
              🏆 {m}g
            </span>
          ))}
        </div>
      ) : null}
      <ul className="mt-3 space-y-1 border-t border-[color:var(--divider)] pt-2">
        {recent.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-2 text-xs text-[color:var(--text-muted)]">
            <span className="min-w-0 truncate">
              {RATING_EMOJI[e.rating] ?? "🍳"} {e.dish} · {e.versionLabel}
            </span>
            <span className="shrink-0 tabular-nums">{signed(e.proteinAddedG * Math.max(1, e.servings))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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

function modeFullLabel(mode: string): string {
  return mode === "lean" ? "Fully Light" : "Full Send";
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
  const [cooked, setCooked] = useState<CookEntry[]>([]);

  const refresh = () => setRecipes(getSavedRecipes());
  useEffect(() => {
    const doRefresh = () => refresh();
    const refreshCooked = () => setCooked(getCookLog());
    void initRecipeLogNativeStorage().then(doRefresh);
    void initCookLogNativeStorage().then(refreshCooked);
    window.addEventListener(RECIPE_LOG_EVENT, doRefresh);
    window.addEventListener(COOK_LOG_EVENT, refreshCooked);
    window.addEventListener("storage", doRefresh);
    return () => {
      window.removeEventListener(RECIPE_LOG_EVENT, doRefresh);
      window.removeEventListener(COOK_LOG_EVENT, refreshCooked);
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

        <ProteinBankCard entries={cooked} />

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
                        Close Match {signed(Number(close ?? 0))} → {modeFullLabel(recipe.mode)} {signed(Number(full ?? 0))}
                      </div>
                      <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">Saved {getRelativeTime(recipe.savedAt)}</div>
                      <div className="mt-2 text-[11px] font-semibold text-[color:var(--accent-strong)]">Tap to open →</div>
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

