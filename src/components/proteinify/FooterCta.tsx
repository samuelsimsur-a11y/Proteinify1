export default function FooterCta() {
  return (
    <footer className="w-full border-t border-[color:var(--divider)] bg-[color:var(--bg)]">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-10">
        <div className="text-sm text-[color:var(--text-muted)]">
          Proteinify helps you upgrade foods you already love into higher-protein versions
          without making them weird.
        </div>
        <div className="text-xs text-[color:var(--text-muted)]">
          No account needed. Nothing saved, nothing tracked.
        </div>
      </div>
    </footer>
  );
}

