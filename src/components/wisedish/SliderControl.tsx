"use client";

type Props = {
  label: string;
  value: number;
  onChange: (nextValue: number) => void;
  hintLow: string;
  hintHigh: string;
  disabled?: boolean;
};

export default function SliderControl({
  label,
  value,
  onChange,
  hintLow,
  hintHigh,
  disabled,
}: Props) {
  return (
    <div className="rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] p-4">
      <div className="font-display text-sm font-semibold text-[color:var(--text-primary)]">{label}</div>
      <div className="mt-2 flex flex-col gap-2">
        <div className="flex justify-between gap-3 text-xs leading-snug text-[color:var(--text-muted)]">
          <span className="max-w-[48%] shrink-0">{hintLow}</span>
          <span className="max-w-[48%] shrink-0 text-right">{hintHigh}</span>
        </div>
        <div className="text-center text-xs font-semibold tabular-nums text-[color:var(--text-primary)]">
          {value}
          <span className="font-normal text-[color:var(--text-muted)]">/10</span>
        </div>
      </div>

      <input
        className="mt-3 w-full accent-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

