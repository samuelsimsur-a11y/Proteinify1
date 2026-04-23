"use client";

import { useEffect, useState } from "react";
import { Preferences } from "@capacitor/preferences";
import foodzapMark from "@/assets/brand/foodzap-mark.jpg";
import { isCapacitorNative } from "@/lib/capacitorEnv";
import { RECIPE_LOG_EVENT, getSavedRecipes, initRecipeLogNativeStorage } from "@/lib/recipeLog";

const THEME_KEY = "foodzap-theme";

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

/** Bundled under `/_next/static/media/*` so the mark works even when `public/` URLs 404 (mis-rooted deploys). */
const MARK_SRC = `${foodzapMark.src}?v=${encodeURIComponent(process.env.NEXT_PUBLIC_FOODZAP_BUILD_ID ?? "1")}`;

/** Brand mark: fork + lightning (asset matches tile `#121212`; no white matting). */
function FoodZapLogo() {
  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-2 sm:gap-2.5">
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-[#121212] ring-1 ring-white/10 sm:h-10 sm:w-10">
        <img
          src={MARK_SRC}
          alt=""
          width={80}
          height={80}
          decoding="async"
          className="h-full w-full object-cover object-center"
        />
      </div>
      <div className="min-w-0 leading-none">
        <div className="font-display whitespace-nowrap text-sm font-extrabold tracking-tight text-[color:var(--accent)] sm:text-base">
          FoodZap
        </div>
      </div>
    </div>
  );
}

/** Bookmark — same visual language as the marketing site “My recipes” chip. */
function BookmarkRecipesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M6 4.5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 4.5v15.2a.3.3 0 0 1-.46.25L12 16.5l-5.54 3.45A.3.3 0 0 1 6 19.7V4.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Header() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [scrolled, setScrolled] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [hasManualThemeChoice, setHasManualThemeChoice] = useState(false);

  useEffect(() => {
    let mounted = true;
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const getSystemTheme = (): "light" | "dark" => (media?.matches ? "dark" : "light");

    const applyTheme = (next: "light" | "dark") => {
      if (!mounted) return;
      setTheme(next);
      if (next === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    };

    void (async () => {
      let value: "light" | "dark" | null = null;
      let manual = false;
      try {
        if (isCapacitorNative()) {
          const saved = await Preferences.get({ key: THEME_KEY });
          value = saved.value === "dark" || saved.value === "light" ? saved.value : null;
        } else {
          const raw = window.localStorage.getItem(THEME_KEY);
          value = raw === "dark" || raw === "light" ? raw : null;
        }
        manual = Boolean(value);
        setHasManualThemeChoice(manual);
        applyTheme(value ?? getSystemTheme());
      } catch {
        setHasManualThemeChoice(false);
        applyTheme(getSystemTheme());
      }
    })();

    const onSystemThemeChange = (event: MediaQueryListEvent) => {
      if (hasManualThemeChoice) return;
      applyTheme(event.matches ? "dark" : "light");
    };
    media?.addEventListener?.("change", onSystemThemeChange);

    return () => {
      mounted = false;
      media?.removeEventListener?.("change", onSystemThemeChange);
    };
  }, [hasManualThemeChoice]);

  useEffect(() => {
    const updateCount = () => setSavedCount(getSavedRecipes().length);
    updateCount();
    void initRecipeLogNativeStorage().finally(() => updateCount());
    window.addEventListener("storage", updateCount);
    window.addEventListener(RECIPE_LOG_EVENT, updateCount);
    return () => {
      window.removeEventListener("storage", updateCount);
      window.removeEventListener(RECIPE_LOG_EVENT, updateCount);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleTheme = async () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setHasManualThemeChoice(true);
    if (next === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    try {
      if (isCapacitorNative()) {
        await Preferences.set({ key: THEME_KEY, value: next });
      } else {
        window.localStorage.setItem(THEME_KEY, next);
      }
    } catch {
      // Session theme still updates if storage fails.
    }
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
          "mx-auto flex h-16 w-full max-w-3xl flex-nowrap items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4",
          scrolled ? "border-b border-[color:var(--divider)]" : "border-b border-transparent",
        ].join(" ")}
      >
        <a href="/" className="flex min-w-0 flex-1 items-center overflow-hidden pr-1" aria-label="FoodZap home">
          <FoodZapLogo />
        </a>

        <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-3">
          <a href="#how-it-works" className="hidden text-xs font-semibold text-[color:var(--text-muted)] sm:block">
            How it works
          </a>
          <a
            href="/log"
            aria-label={savedCount > 0 ? `My recipes, ${savedCount} saved` : "My recipes"}
            className={[
              "relative z-10 inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 sm:h-11 sm:px-3.5",
              "whitespace-nowrap bg-[color:var(--surface-offset)] text-[color:var(--accent)]",
              "border-[color:rgba(232,113,10,0.45)] hover:border-[color:var(--accent)]",
            ].join(" ")}
          >
            <BookmarkRecipesIcon />
            <span className="text-[11px] font-semibold sm:text-xs">My recipes</span>
            {savedCount > 0 ? (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[color:var(--accent)] px-1.5 text-center text-[10px] font-bold leading-5 text-black">
                {savedCount > 9 ? "9+" : savedCount}
              </span>
            ) : null}
          </a>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className={[
              "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
              "border-[color:rgba(232,113,10,0.35)] bg-[color:var(--surface-card)] text-[color:var(--text-muted)]",
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

