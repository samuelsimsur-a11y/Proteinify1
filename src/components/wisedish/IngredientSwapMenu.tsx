"use client";

import { useId, useState } from "react";
import type { SwapIntent } from "@/lib/wisedish/clientGenerate";
import { humanizeIngredientDisplay } from "./humanizeIngredientDisplay";

type Props = {
  ingredientName: string;
  disabled?: boolean;
  onSwap: (request: { intent: SwapIntent; replacement?: string }) => void;
};

const OPTIONS: { intent: Exclude<SwapIntent, "replace">; label: string; effect: string }[] = [
  { intent: "higher-protein", label: "More protein", effect: "Swap for a higher-protein ingredient that fits this dish" },
  { intent: "closer-to-original", label: "Keep it classic", effect: "Go back toward what the traditional dish uses" },
  { intent: "remove", label: "Leave it out", effect: "Remove it and rebalance the rest" },
];

export default function IngredientSwapMenu({ ingredientName, disabled, onSwap }: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const inputId = useId();

  const pick = (request: { intent: SwapIntent; replacement?: string }) => {
    onSwap(request);
    setOpen(false);
    setCustom("");
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={[
          "min-h-11 rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
          "border-[color:var(--divider)] bg-[color:var(--surface-card)] text-[color:var(--text-muted)]",
          "hover:bg-[color:var(--accent-light)] hover:text-[color:var(--text-primary)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        ].join(" ")}
      >
        Swap
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-[min(calc(100vw-2rem),22rem)] min-w-[17.5rem] rounded-2xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] p-3 shadow-lg ring-1 ring-black/5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 truncate text-xs font-semibold text-[color:var(--text-primary)]">
              Swap {humanizeIngredientDisplay(ingredientName)}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 shrink-0 px-2 text-xs text-[color:var(--text-muted)]"
            >
              Close
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {OPTIONS.map((opt) => (
              <button
                key={opt.intent}
                type="button"
                onClick={() => pick({ intent: opt.intent })}
                className="w-full rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] px-3 py-2.5 text-left text-xs leading-snug transition hover:bg-[color:var(--surface-offset)]"
              >
                <div className="font-display font-semibold text-[color:var(--text-primary)]">{opt.label}</div>
                <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">{opt.effect}</div>
              </button>
            ))}
            <form
              className="rounded-xl border border-[color:var(--divider)] p-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                const value = custom.trim();
                if (value) pick({ intent: "replace", replacement: value });
              }}
            >
              <label className="block text-xs font-semibold text-[color:var(--text-primary)]" htmlFor={inputId}>
                Use something I have instead
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id={inputId}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. Greek yogurt"
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-[color:var(--divider)] bg-[color:var(--bg)] px-3 text-xs text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)]"
                />
                <button
                  type="submit"
                  disabled={!custom.trim()}
                  className="min-h-11 shrink-0 rounded-lg bg-[color:var(--accent)] px-3 text-xs font-semibold text-[color:var(--on-accent)] disabled:opacity-50"
                >
                  Use this
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
