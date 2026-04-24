"use client";

import { useEffect } from "react";

const BUILD_KEY = "wisedish_build_id";
/** Bump value (e.g. v2 → v3) to force one hard refresh on every device after a sticky WebView UI fix. */
const EPOCH_KEY = "wisedish_ui_epoch";
const LEGACY_BUILD_KEY = "foodzap_build_id";
const LEGACY_EPOCH_KEY = "foodzap_ui_epoch";
const EPOCH_MARK = "v14";

async function bustCachesAndReload() {
  if ("caches" in window && typeof caches.keys === "function") {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      // ignore cache API failures and proceed with reload
    }
  }
  window.location.reload();
}

/**
 * 1) Epoch: one reload when we bump EPOCH_MARK (survives “same deploy id” edge cases).
 * 2) Build id: reload when Vercel deploy id / git SHA changes.
 */
export default function AppVersionReload() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const legacyBuild = localStorage.getItem(LEGACY_BUILD_KEY);
      if (legacyBuild && !localStorage.getItem(BUILD_KEY)) {
        localStorage.setItem(BUILD_KEY, legacyBuild);
      }
      if (localStorage.getItem(EPOCH_KEY) !== EPOCH_MARK) {
        localStorage.setItem(EPOCH_KEY, EPOCH_MARK);
        localStorage.removeItem(LEGACY_EPOCH_KEY);
        const current = process.env.NEXT_PUBLIC_FOODZAP_BUILD_ID;
        if (current && current !== "local") {
          localStorage.setItem(BUILD_KEY, current);
        }
        void bustCachesAndReload();
        return;
      }

      const current = process.env.NEXT_PUBLIC_FOODZAP_BUILD_ID;
      if (!current || current === "local") return;

      const prev = localStorage.getItem(BUILD_KEY);
      if (!prev) {
        localStorage.setItem(BUILD_KEY, current);
        return;
      }
      if (prev !== current) {
        localStorage.setItem(BUILD_KEY, current);
        void bustCachesAndReload();
      }
    } catch {
      /* private mode / storage blocked */
    }
  }, []);

  return null;
}
