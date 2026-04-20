export default function HeroSection() {
  return (
    <section className="px-4 pt-10">
      <div className="mx-auto w-full max-w-3xl">
        <div
          className="relative rounded-2xl border border-[color:rgba(40,25,10,0.08)] p-6 pf-card"
          style={{
            backgroundImage:
              "radial-gradient(circle at 100% 100%, rgba(232,113,10,0.03) 0%, rgba(232,113,10,0) 60%)",
          }}
        >
          <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[1.05] tracking-tight text-[color:var(--text-primary)]">
            Your dish. More protein. Same soul.
          </h1>
          <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-[color:var(--text-muted)]">
            Tell us what you&apos;re cooking. Get three protein-optimised versions — each with a different trade-off.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <div className="rounded-full border px-3 py-1 text-xs font-semibold text-[color:var(--accent)] bg-[color:var(--surface-offset)]">
              🍛 Biryani +34g protein
            </div>
            <div className="rounded-full border px-3 py-1 text-xs font-semibold text-[color:var(--accent)] bg-[color:var(--surface-offset)]">
              🌮 Birria Tacos +28g protein
            </div>
            <div className="rounded-full border px-3 py-1 text-xs font-semibold text-[color:var(--accent)] bg-[color:var(--surface-offset)]">
              🍜 Pad Thai +22g protein
            </div>
          </div>

          <div className="relative mt-5 w-full max-h-[200px] overflow-hidden rounded-2xl md:max-h-[320px]">
            <img
              src="https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=1200&q=80"
              alt="A bowl of biryani — the kind of dish Proteinify transforms"
              width={1200}
              height={320}
              loading="eager"
              className="h-[200px] w-full object-cover md:h-[320px]"
              style={{ borderRadius: 16 }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%]"
              style={{
                background: "linear-gradient(to top, rgba(0,0,0,0.45), transparent)",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

