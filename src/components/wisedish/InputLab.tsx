"use client";

import { useEffect, useRef, useState } from "react";
import type { SliderValues } from "@/lib/wisedish/types";
import SliderControl from "./SliderControl";
import ExampleChips from "./ExampleChips";
import VeggieToggle from "./VeggieToggle";

const SERVING_OPTIONS = [1, 2, 4, 6, 8] as const;

export type ModeId = "wisedish" | "lean";

type Props = {
  inputDish: string;
  sliders: SliderValues;
  onChangeDish: (next: string) => void;
  onChangeSlider: <K extends keyof SliderValues>(key: K, value: number) => void;
  mode: ModeId;
  onChangeMode: (mode: ModeId) => void;
  addVeggies: boolean;
  onAddVeggiesChange: (next: boolean) => void;
  servings: 1 | 2 | 4 | 6 | 8;
  onChangeServings: (next: 1 | 2 | 4 | 6 | 8) => void;
  thirdVersionLabel: "Full Send" | "Fully Light";
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  onGenerate: () => void;
  chips: string[];
  onPickExample: (dish: string) => void;
  isGenerating?: boolean;
  isImporting?: boolean;
  /** True while initial load, full generate, or single-version regeneration */
  disabled?: boolean;
  disambiguationOptions?: { assumed: string | null; variants: string[] } | null;
  onPickDisambiguationVariant?: (variant: string) => void;
  onDisambiguationOther?: () => void;
};

export default function InputLab({
  inputDish,
  sliders,
  onChangeDish,
  onChangeSlider,
  mode,
  onChangeMode,
  addVeggies,
  onAddVeggiesChange,
  servings,
  onChangeServings,
  thirdVersionLabel,
  showAdvanced,
  onToggleAdvanced,
  onGenerate,
  chips,
  onPickExample,
  isGenerating,
  isImporting,
  disabled,
  disambiguationOptions,
  onPickDisambiguationVariant,
  onDisambiguationOther,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [sourceHint, setSourceHint] = useState<string | null>(null);

  useEffect(() => {
    if (!sourceHint) return;
    const t = window.setTimeout(() => setSourceHint(null), 2200);
    return () => window.clearTimeout(t);
  }, [sourceHint]);

  const tryPasteUrlFromClipboard = async (source: "tiktok" | "youtube") => {
    inputRef.current?.focus();
    const sourceLabel = source === "tiktok" ? "TikTok" : "YouTube";
    const matcher =
      source === "tiktok"
        ? /(https?:\/\/[^\s]*tiktok\.com[^\s]*)/i
        : /(https?:\/\/[^\s]*(youtube\.com|youtu\.be)[^\s]*)/i;

    if (!navigator.clipboard?.readText) {
      setSourceHint(`Clipboard access is unavailable. Paste a ${sourceLabel} link manually.`);
      return;
    }

    try {
      const text = (await navigator.clipboard.readText()).trim();
      const hit = text.match(matcher)?.[1]?.trim();
      if (hit) {
        onChangeDish(hit);
        setSourceHint(`${sourceLabel} link pasted from clipboard.`);
        return;
      }
      setSourceHint(`No ${sourceLabel} link found in clipboard. Paste one into the input.`);
    } catch {
      setSourceHint(`Clipboard permission blocked. Paste a ${sourceLabel} link manually.`);
    }
  };

  const modeMeta: Record<
    ModeId,
    { bg: string; glow: string; tagline: string; buttonText: string }
  > = {
    wisedish: {
      bg: "var(--accent)",
      glow: "rgba(200,170,106,0.34)",
      tagline: "Same dish, more fuel",
      buttonText: "Wise Dish this dish →",
    },
    lean: {
      bg: "var(--accent-gold)",
      glow: "rgba(30,48,71,0.26)",
      tagline: "Same dish, lighter",
      buttonText: "Lean this dish →",
    },
  };

  const active = modeMeta[mode];

  const modeButtons = [
    ["wisedish", "⚡ Wise Dish", modeMeta.wisedish.tagline],
    ["lean", "🔥 Lean Mode", modeMeta.lean.tagline],
  ] as const;

  return (
    <section className="px-4 pt-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="pf-card p-4">
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-sm font-display font-semibold text-[color:var(--text-primary)]">
                What dish are you transforming today?
              </div>
            </div>

            {/* MODE SELECTOR */}
            <div className="grid gap-3 sm:grid-cols-2">
              {modeButtons.map(([id, label, tagline]) => {
                const activeNow = mode === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onChangeMode(id)}
                    disabled={disabled}
                    className={[
                      "relative flex flex-col items-start justify-between overflow-hidden rounded-[var(--radius-pill)] px-4 py-4 text-left transition-all duration-200",
                      "border",
                      activeNow
                        ? "border-transparent text-white"
                        : "border-[color:var(--divider)] bg-[color:var(--surface-card)] text-[color:var(--text-primary)]",
                    ].join(" ")}
                    style={
                      activeNow
                        ? {
                            backgroundColor: modeMeta[id].bg,
                            boxShadow: `0 4px 16px ${modeMeta[id].glow}`,
                          }
                        : undefined
                    }
                  >
                    <div className="font-display text-base font-extrabold leading-tight">{label}</div>
                    <div className="mt-1 text-xs font-semibold opacity-95">{tagline}</div>
                  </button>
                );
              })}
            </div>

            {/* INPUT AREA */}
            <div>
              <input
                ref={inputRef}
                type="text"
                value={inputDish}
                onChange={(e) => onChangeDish(e.target.value)}
                disabled={disabled}
                placeholder="Dish name or paste a TikTok / YouTube link"
                className={[
                  "mt-1 w-full rounded-[var(--radius-pill)] border-2 bg-[color:var(--bg)] px-6 py-4 text-sm",
                  "border-[color:rgba(40,25,10,0.15)] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-faint)]",
                  "focus:outline-none focus:border-2 focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:rgba(30,48,71,0.18)]",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                ].join(" ")}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  title="Paste a TikTok link from clipboard"
                  disabled={disabled}
                  onClick={(e) => {
                    e.preventDefault();
                    void tryPasteUrlFromClipboard("tiktok");
                  }}
                  className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-3 text-xs font-semibold text-[color:var(--text-muted)]"
                >
                  <span aria-hidden>TikTok</span>
                </button>
                <button
                  type="button"
                  title="Paste a YouTube link from clipboard"
                  disabled={disabled}
                  onClick={(e) => {
                    e.preventDefault();
                    void tryPasteUrlFromClipboard("youtube");
                  }}
                  className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-3 text-xs font-semibold text-[color:var(--text-muted)]"
                >
                  <span aria-hidden>YouTube</span>
                </button>
              </div>
              {sourceHint ? (
                <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">{sourceHint}</div>
              ) : null}

              <div className="mt-3">
                <div className="text-xs font-semibold text-[color:var(--text-muted)]">Examples</div>
                <div className="mt-2">
                  <ExampleChips chips={chips} onPick={onPickExample} disabled={disabled} />
                </div>
              </div>
            </div>

            {/* ADVANCED TOGGLE */}
            <button
              type="button"
              onClick={onToggleAdvanced}
              disabled={disabled}
              className="self-start text-xs font-semibold text-[color:var(--text-muted)] hover:text-[color:var(--accent)]"
            >
              Fine-tune ⚙
            </button>

            {/* SLIDERS PANEL (ADVANCED) */}
            {showAdvanced ? (
              <div className="grid gap-4">
                <div>
                  <div className="text-xs font-semibold text-[color:var(--text-muted)]">Recipe yield</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SERVING_OPTIONS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChangeServings(n)}
                        className={[
                          "h-10 min-w-[2.75rem] rounded-full border px-3 text-xs font-semibold transition-colors",
                          servings === n
                            ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white"
                            : "border-[color:var(--divider)] bg-[color:var(--surface-card)] text-[color:var(--text-primary)]",
                        ].join(" ")}
                      >
                        {n}
                      </button>
                    ))}
                    <span className="self-center text-[11px] text-[color:var(--text-muted)]">servings</span>
                  </div>
                </div>
                <VeggieToggle value={addVeggies} onChange={onAddVeggiesChange} disabled={disabled} />
                <div className="grid gap-4 sm:grid-cols-3">
                <SliderControl
                  label="How close to the original?"
                  value={sliders.tasteIntegrity}
                  hintLow="More freedom to change ingredients"
                  hintHigh="Keep flavor and texture familiar"
                  disabled={disabled}
                  onChange={(v) => onChangeSlider("tasteIntegrity", v)}
                />
                <SliderControl
                  label="Protein intensity"
                  value={sliders.proteinBoost}
                  hintLow="Modest upgrade"
                  hintHigh="Push protein hard"
                  disabled={disabled}
                  onChange={(v) => onChangeSlider("proteinBoost", v)}
                />
                <SliderControl
                  label="Shopping ease"
                  value={sliders.pantryRealism}
                  hintLow="Specialty or niche items OK"
                  hintHigh="Mostly regular grocery staples"
                  disabled={disabled}
                  onChange={(v) => onChangeSlider("pantryRealism", v)}
                />
                </div>
              </div>
            ) : null}

            {disambiguationOptions && disambiguationOptions.variants.length > 1 ? (
              <div className="rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-offset)] px-3 py-3">
                <div className="text-xs font-semibold text-[color:var(--text-primary)]">
                  We see a few versions of this dish — which are you making?
                </div>
                {disambiguationOptions.assumed ? (
                  <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                    Our best guess: {disambiguationOptions.assumed}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {disambiguationOptions.variants.map((variant) => (
                    <button
                      key={variant}
                      type="button"
                      onClick={() => onPickDisambiguationVariant?.(variant)}
                      className="rounded-[var(--radius-pill)] border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-primary)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                    >
                      {variant}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => onDisambiguationOther?.()}
                    className="rounded-[var(--radius-pill)] border border-dashed border-[color:var(--divider)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] hover:text-[color:var(--accent)]"
                  >
                    Other — I&apos;ll describe it
                  </button>
                </div>
              </div>
            ) : null}

            {/* CTA */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-[color:var(--text-muted)]">
                You’ll get 3 versions: Close Match, Balanced, {thirdVersionLabel}.
              </div>

              <button
                type="button"
                onClick={onGenerate}
                disabled={disabled || isGenerating}
                className={[
                  "h-14 w-full rounded-[var(--radius-pill)] text-center font-display text-[18px] font-extrabold text-white transition-all",
                  "disabled:opacity-60",
                  "transform-gpu hover:scale-[1.02] hover:brightness-[0.97]",
                ].join(" ")}
                style={{
                  backgroundColor: active.bg,
                  boxShadow: `0 4px 16px ${active.glow}`,
                }}
              >
                {isImporting ? "Importing recipe..." : isGenerating ? "Transforming..." : active.buttonText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
