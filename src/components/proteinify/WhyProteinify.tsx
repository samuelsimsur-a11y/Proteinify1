export default function WhyProteinify() {
  return (
    <section className="px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="pf-card p-6">
          <h2 className="font-display text-base font-semibold text-[color:var(--text-primary)]">Why Proteinify</h2>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--text-muted)]">
            <span className="font-medium text-[color:var(--text-primary)]">
              We track what matters for transformation — protein.
            </span>{" "}
            This isn&apos;t a calorie counter: we don&apos;t show calories, fat, or carbs. Proteinify is a
            transformation engine that upgrades dishes you already crave into higher-protein versions you can
            actually cook.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] p-4">
              <div className="font-display text-xs font-semibold text-[color:var(--text-primary)]">Taste</div>
              <div className="mt-2 text-xs text-[color:var(--text-muted)]">Preserve identity and mouthfeel.</div>
            </div>
            <div className="rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] p-4">
              <div className="font-display text-xs font-semibold text-[color:var(--text-primary)]">Protein</div>
              <div className="mt-2 text-xs text-[color:var(--text-muted)]">Aggressive when you want it.</div>
            </div>
            <div className="rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-card)] p-4">
              <div className="font-display text-xs font-semibold text-[color:var(--text-primary)]">Realism</div>
              <div className="mt-2 text-xs text-[color:var(--text-muted)]">Prefer common grocery items.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

