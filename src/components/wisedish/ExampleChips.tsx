"use client";

type Props = {
  chips: string[];
  onPick: (dish: string) => void;
  disabled?: boolean;
};

export default function ExampleChips({ chips, onPick, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <button
          key={c}
          type="button"
          disabled={disabled}
          onClick={() => onPick(c)}
          className={[
            "rounded-full px-3 py-1 text-xs font-semibold transition active:scale-[0.99]",
            "bg-[color:var(--surface-offset)] text-[color:var(--text-muted)]",
            "hover:bg-[color:var(--accent-light)] hover:text-[color:var(--accent)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          ].join(" ")}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

