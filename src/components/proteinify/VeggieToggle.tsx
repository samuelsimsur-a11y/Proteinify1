"use client";

type Props = {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

export default function VeggieToggle({ value, onChange, disabled }: Props) {
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-base" aria-hidden>
          🥦
        </span>
        <span className="text-[13px] leading-snug transition-colors duration-[180ms] ease-out">
          {value ? (
            <span className="font-medium text-[color:var(--accent-forest)]">
              Vegetables included in all versions ✓
            </span>
          ) : (
            <span className="text-[color:var(--text-muted)]">Add vegetables to all versions</span>
          )}
        </span>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className="relative h-8 w-[52px] shrink-0 rounded-full p-0.5 transition-[background-color] duration-[180ms] ease-out disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          backgroundColor: value ? "var(--accent)" : "var(--divider)",
        }}
      >
        <span
          className="block h-7 w-7 rounded-full bg-white shadow-sm transition-transform duration-[180ms] ease-out"
          style={{
            transform: value ? "translateX(20px)" : "translateX(0)",
          }}
        />
      </button>
    </div>
  );
}
