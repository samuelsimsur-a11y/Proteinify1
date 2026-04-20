export default function HowItWorks() {
  return (
    <section id="how-it-works" className="px-4 pt-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="pf-card p-6">
          <h2 className="font-display text-base font-semibold text-[color:var(--text-primary)]">How it works</h2>
          <ol className="mt-4 list-none space-y-3 pl-0 text-sm text-[color:var(--text-muted)]">
            <li className="flex gap-2">
              <span className="font-display font-semibold text-[color:var(--text-primary)] shrink-0">1.</span>
              <span>Type any dish you already make.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-display font-semibold text-[color:var(--text-primary)] shrink-0">2.</span>
              <span>Pick a mode and adjust the sliders if you want.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-display font-semibold text-[color:var(--text-primary)] shrink-0">3.</span>
              <span>
                Get three versions — Close Match keeps it familiar, Full Send pushes hard.
              </span>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
