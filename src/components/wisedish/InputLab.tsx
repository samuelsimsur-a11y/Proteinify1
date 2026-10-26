"use client";

import { useEffect, useRef, useState } from "react";
import type { SliderValues } from "@/lib/wisedish/types";
import SliderControl from "./SliderControl";
import ExampleChips from "./ExampleChips";
import VeggieToggle from "./VeggieToggle";
import ProteinBankChip from "./ProteinBankChip";

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
  /** True while a generation, swap or import is running */
  disabled?: boolean;
  disambiguationOptions?: { assumed: string | null; variants: string[] } | null;
  onPickDisambiguationVariant?: (variant: string) => void;
  onDisambiguationOther?: () => void;
};

const MODES: { id: ModeId; label: string; tagline: string; button: string }[] = [
  { id: "wisedish", label: "⚡ More protein", tagline: "Same dish, more fuel", button: "Wise Dish this dish →" },
  { id: "lean", label: "🔥 Lighter", tagline: "Same dish, fewer calories", button: "Lean this dish →" },
];

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
      setSourceHint(`No ${sourceLabel} link found in clipboard. Paste one into the box.`);
    } catch {
      setSourceHint(`Clipboard permission blocked. Paste a ${sourceLabel} link manually.`);
    }
  };

  const active = MODES.find((m) => m.id === mode) ?? MODES[0]!;
  const canGenerate = inputDish.trim().length > 0;

  return (
    <section className="px-4 pt-4">
      <div className="mx-auto w-full max-w-3xl">
        <form
          className="pf-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (disabled) return;
            if (!canGenerate) {
              // Keep the main button tappable: nudge toward the input instead of looking disabled.
              inputRef.current?.focus();
              setSourceHint("Type a dish first — or tap an example below.");
              return;
            }
            onGenerate();
          }}
        >
          <div className="flex flex-col gap-3">
            <label
              htmlFor="dish-input"
              className="text-sm font-display font-semibold text-[color:var(--text-primary)]"
            >
              What are you cooking?
            </label>

            {/* INPUT AREA */}
            <div>
              <input
                id="dish-input"
                ref={inputRef}
                type="text"
                inputMode="text"
                enterKeyHint="go"
                autoComplete="off"
                value={inputDish}
                onChange={(e) => onChangeDish(e.target.value)}
                disabled={disabled}
                placeholder="e.g. chicken alfredo, or paste a TikTok / YouTube link"
                className={[
                  "w-full rounded-[var(--radius-pill)] border-2 bg-[color:var(--bg)] px-5 py-3.5 text-base",
                  "border-[color:rgba(40,25,10,0.18)] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)]",
                  "focus:outline-none focus:border-2 focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:rgba(30,48,71,0.18)]",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                ].join(" ")}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-[color:var(--text-muted)]">Paste a link from</span>
                <button
                  type="button"
                  title="Paste a TikTok link from clipboard"
                  disabled={disabled}
                  onClick={() => void tryPasteUrlFromClipboard("tiktok")}
                  className="inline-flex min-h-9 items-center rounded-full border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-3 text-xs font-semibold text-[color:var(--text-muted)]"
                >
                  TikTok
                </button>
                <button
                  type="button"
                  title="Paste a YouTube link from clipboard"
                  disabled={disabled}
                  onClick={() => void tryPasteUrlFromClipboard("youtube")}
                  className="inline-flex min-h-9 items-center rounded-full border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-3 text-xs font-semibold text-[color:var(--text-muted)]"
                >
                  YouTube
                </button>
              </div>
              {sourceHint ? (
                <div className="mt-1 text-[11px] text-[color:var(--text-muted)]" role="status">
                  {sourceHint}
                </div>
              ) : null}

              <div className="mt-3">
                <div className="text-xs font-semibold text-[color:var(--text-muted)]">Or tap an example</div>
                <div className="mt-1.5">
                  <ExampleChips chips={chips} onPick={onPickExample} disabled={disabled} />
                </div>
              </div>
            </div>

            {/* MODE */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-[color:var(--text-muted)]">
                  Goal <span className="font-normal">· {active.tagline}</span>
                </div>
                <button
                  type="button"
                  onClick={onToggleAdvanced}
                  disabled={disabled}
                  aria-expanded={showAdvanced}
                  className="min-h-9 shrink-0 text-xs font-semibold text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
                >
                  Fine-tune ⚙
                </button>
              </div>
              <div
                role="radiogroup"
                aria-label="Goal"
                className="mt-1 grid grid-cols-2 gap-1 rounded-[var(--radius-pill)] border border-[color:var(--divider)] bg-[color:var(--surface-offset)] p-1"
              >
                {MODES.map((m) => {
                  const on = m.id === mode;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={disabled}
                      onClick={() => onChangeMode(m.id)}
                      className={[
                        "min-h-11 rounded-[var(--radius-pill)] px-3 text-sm font-bold transition",
                        on
                          ? "bg-[color:var(--accent)] text-[color:var(--on-accent)] shadow-sm"
                          : "text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]",
                      ].join(" ")}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

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
                            ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--on-accent)]"
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
                      className="min-h-9 rounded-[var(--radius-pill)] border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-primary)] hover:border-[color:var(--accent)]"
                    >
                      {variant}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => onDisambiguationOther?.()}
                    className="min-h-9 rounded-[var(--radius-pill)] border border-dashed border-[color:var(--divider)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
                  >
                    Other — I&apos;ll describe it
                  </button>
                </div>
              </div>
            ) : null}

            {/* CTA */}
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={disabled || isGenerating}
                className={[
                  "h-14 w-full rounded-[var(--radius-pill)] text-center font-display text-[18px] font-extrabold transition-all",
                  "bg-[color:var(--accent)] text-[color:var(--on-accent)] shadow-[0_4px_16px_rgba(198,169,104,0.34)]",
                  "disabled:opacity-60 transform-gpu hover:scale-[1.01] hover:brightness-[0.97]",
                ].join(" ")}
              >
                {isImporting ? "Importing recipe…" : isGenerating ? "Transforming…" : active.button}
              </button>
              <div className="text-center text-[11px] text-[color:var(--text-muted)]">
                You&apos;ll get 3 versions: Close Match, Balanced, {thirdVersionLabel}.
              </div>
              <ProteinBankChip />
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
