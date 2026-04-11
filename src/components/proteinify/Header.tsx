"use client";

import { useEffect, useState } from "react";

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 12.7A8.5 8.5 0 0 1 11.3 3a6.8 6.8 0 1 0 9.7 9.7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProteinLogo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="17" cy="17" r="15" fill="var(--accent)" />
        {/* Simple helix / dumbbell mark in white */}
        <path
          d="M10.2 12.5c2.2 2.2 11.4 2.2 13.6 0"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M10.2 21.5c2.2-2.2 11.4-2.2 13.6 0"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M12 14.5c1.2 1.2 1.2 4.8 0 6"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M22 14.5c-1.2 1.2-1.2 4.8 0 6"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      <div className="leading-none">
        <div className="font-display text-base font-extrabold text-[color:var(--accent)]">
          Proteinify
        </div>
      </div>
    </div>
  );
}

export default function Header() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem("proteinify-theme") as "light" | "dark" | null) ?? null;
    const initial: "light" | "dark" = saved ?? (window.matchMedia?.("(prefers-color-scheme: dark)") ? "dark" : "light");
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("proteinify-theme", next);
  };

  return (
    <header
      className={[
        "sticky top-0 z-30 h-16 w-full transition-colors",
        scrolled ? "bg-[color:var(--bg)]" : "bg-transparent",
      ].join(" ")}
    >
      <div
        className={[
          "mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4",
          scrolled ? "border-b border-[color:var(--divider)]" : "border-b border-transparent",
        ].join(" ")}
      >
        <a href="/" aria-label="Proteinify home">
          <ProteinLogo />
        </a>

        <div className="flex items-center gap-4">
          <a href="#how-it-works" className="hidden text-xs font-semibold text-[color:var(--text-muted)] sm:block">
            How it works
          </a>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className={[
              "inline-flex h-9 w-9 items-center justify-center rounded-xl border",
              "bg-[color:var(--surface-card)] text-[color:var(--text-muted)]",
              "hover:border-[color:var(--accent)]",
            ].join(" ")}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>
    </header>
  );
}

