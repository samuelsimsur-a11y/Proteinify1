"use client";

export default function PrivacyPage() {
  return (
    <section className="px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="pf-card p-6">
          <h1 className="font-display text-xl font-bold text-[color:var(--text-primary)]">Privacy policy</h1>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--text-muted)]">
            Wise Dish is designed to be privacy-first.
          </p>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-[color:var(--text-muted)]">
            <p>
              <span className="font-semibold text-[color:var(--text-primary)]">Data you enter:</span> Dish names,
              links, and recipe feedback are used only to generate your requested recipe output.
            </p>
            <p>
              <span className="font-semibold text-[color:var(--text-primary)]">Saved recipes:</span> Saved items are
              stored locally on your device (browser storage / app storage) so you can revisit them.
            </p>
            <p>
              <span className="font-semibold text-[color:var(--text-primary)]">No account required:</span> Wise Dish
              does not require login and does not build a personal profile for advertising.
            </p>
            <p>
              <span className="font-semibold text-[color:var(--text-primary)]">Third-party processing:</span> Recipe
              generation may be processed by AI providers to return results. Do not submit sensitive personal data in
              prompts.
            </p>
            <p>
              <span className="font-semibold text-[color:var(--text-primary)]">Contact:</span> For privacy requests,
              contact the app operator through the project support channel.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
