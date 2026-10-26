"use client";

type Props = {
  chips: string[];
  onPick: (dish: string) => void;
  disabled?: boolean;
};

export default function ExampleChips({ chips, onPick, disabled }: Props) {
  return (
    // One swipeable row on phones keeps the main button on the first screen.
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
      {chips.map((c) => (
        <button
          key={c}
          type="button"
          disabled={disabled}
          onClick={() => onPick(c)}
          className={[
            "min-h-9 shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition active:scale-[0.99]",
            "bg-[color:var(--surface-offset)] text-[color:var(--text-muted)]",
            "hover:bg-[color:var(--accent-light)] hover:text-[color:var(--accent-strong)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          ].join(" ")}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

