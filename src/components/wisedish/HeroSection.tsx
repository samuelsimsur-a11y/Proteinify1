"use client";

export type HeroExample = { dish: string; emoji: string; gainG: number };

type Props = {
  examples: HeroExample[];
  onTryExample: (dish: string) => void;
  disabled?: boolean;
};

/**
 * Compact on phones so the dish input is on the first screen. The example chips are real buttons:
 * they open a pre-made result instantly (or generate one) — a zero-wait first taste.
 */
export default function HeroSection({ examples, onTryExample, disabled }: Props) {
  return (
    <section className="px-4 pt-3 sm:pt-10">
      <div className="mx-auto w-full max-w-3xl">
        <div
          className="relative rounded-2xl border border-[color:rgba(40,25,10,0.08)] p-4 pf-card sm:p-6"
          style={{
            backgroundImage:
              "radial-gradient(circle at 100% 100%, rgba(198,169,104,0.16) 0%, rgba(198,169,104,0) 62%)",
          }}
        >
          <h1 className="font-display text-[clamp(1.85rem,7vw,4.5rem)] font-extrabold leading-[1.05] tracking-tight text-[color:var(--text-primary)]">
            Your dish. More protein. Same soul.
          </h1>
          <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-[color:var(--text-muted)] sm:mt-4">
            Type a dish you already make. Get three higher-protein versions — from barely different to all-in.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Try:</span>
            {examples.map((ex) => (
              <button
                key={ex.dish}
                type="button"
                disabled={disabled}
                onClick={() => onTryExample(ex.dish)}
                className="min-h-9 rounded-full border border-[color:var(--accent)]/50 bg-[color:var(--surface-offset)] px-3 py-1 text-xs font-semibold text-[color:var(--text-primary)] transition hover:bg-[color:var(--accent-light)] active:scale-[0.98] disabled:opacity-50"
              >
                <span aria-hidden>{ex.emoji}</span> {ex.dish}{" "}
                <span className="text-[color:var(--accent-strong)]">+{ex.gainG}g</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
