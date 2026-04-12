"use client";

import type { SliderValues } from "@/lib/proteinify/types";
import SliderControl from "./SliderControl";
import ExampleChips from "./ExampleChips";
// import VeggieToggle from "./VeggieToggle"; // hidden for now — keep file for later

export type ModeId = "proteinify" | "lean";

type Props = {
  inputDish: string;
  sliders: SliderValues;
  onChangeDish: (next: string) => void;
  onChangeSlider: <K extends keyof SliderValues>(key: K, value: number) => void;
  mode: ModeId;
  onChangeMode: (mode: ModeId) => void;
  addVeggies: boolean;
  onAddVeggiesChange: (next: boolean) => void;
  thirdVersionLabel: "Full Send" | "Fully Light";
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  onGenerate: () => void;
  chips: string[];
  onPickExample: (dish: string) => void;
  isGenerating?: boolean;
  /** True while initial load, full generate, or single-version regeneration */
  disabled?: boolean;
};

export default function InputLab({
  inputDish,
  sliders,
  onChangeDish,
  onChangeSlider,
  mode,
  onChangeMode,
  addVeggies: _addVeggies,
  onAddVeggiesChange: _onAddVeggiesChange,
  thirdVersionLabel,
  showAdvanced,
  onToggleAdvanced,
  onGenerate,
  chips,
  onPickExample,
  isGenerating,
  disabled,
}: Props) {
  const modeMeta: Record<
    ModeId,
    { bg: string; glow: string; tagline: string; buttonText: string }
  > = {
    proteinify: {
      bg: "var(--accent)",
      glow: "rgba(232,113,10,0.35)",
      tagline: "Same dish, more fuel",
      buttonText: "Proteinify this dish →",
    },
    lean: {
      bg: "var(--accent-gold)",
      glow: "rgba(212,150,10,0.30)",
      tagline: "Same dish, lighter",
      buttonText: "Lean this dish →",
    },
  };

  const active = modeMeta[mode];

  const modeButtons = [
    ["proteinify", "⚡ Proteinify", modeMeta.proteinify.tagline],
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
              <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                Choose a mode, then hit the transformation button — sliders are advanced.
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

            {/* Veggie toggle hidden for now — do not delete component
            <div className="w-full bg-transparent">
              <VeggieToggle value={addVeggies} onChange={onAddVeggiesChange} disabled={disabled} />
            </div>
            */}

            {/* INPUT AREA */}
            <div>
              <input
                type="text"
                value={inputDish}
                onChange={(e) => onChangeDish(e.target.value)}
                disabled={disabled}
                placeholder="What dish are you transforming today?"
                className={[
                  "mt-1 w-full rounded-[var(--radius-pill)] border-2 bg-[color:var(--bg)] px-6 py-4 text-sm",
                  "border-[color:rgba(40,25,10,0.15)] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-faint)]",
                  "focus:outline-none focus:border-2 focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:rgba(232,113,10,0.18)]",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                ].join(" ")}
              />

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
                {isGenerating ? "Transforming..." : active.buttonText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
