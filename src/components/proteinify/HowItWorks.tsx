export default function HowItWorks() {
  return (
    <section id="how-it-works" className="px-4 pt-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="pf-card p-6">
          <h2 className="font-display text-base font-semibold text-[color:var(--text-primary)]">How it works</h2>
          <ol className="mt-4 space-y-3 text-sm text-[color:var(--text-muted)]">
            <li>
              <span className="font-display font-semibold text-[color:var(--text-primary)]">1.</span> Enter a dish name, meal idea, or
              short recipe.
            </li>
            <li>
              <span className="font-display font-semibold text-[color:var(--text-primary)]">2.</span> Tune how close you want the flavor,
              how hard to push protein, and how ordinary the grocery list should stay.
            </li>
            <li>
              <span className="font-display font-semibold text-[color:var(--text-primary)]">3.</span> Generate 3 versions and use
              ingredient swaps to personalize.
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}

