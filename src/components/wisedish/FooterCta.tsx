"use client";

import { useEffect, useState } from "react";
import { getAppRouteHref } from "@/lib/navigation/appRoutes";

type AppVersion = {
  versionName?: string;
  versionCode?: number;
  commitSha?: string;
};

export default function FooterCta() {
  const privacyHref = getAppRouteHref("privacy");
  const [ver, setVer] = useState<AppVersion | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/version.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data === "object") setVer(data as AppVersion);
      })
      .catch(() => {
        /* offline / missing stamp — hide */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const versionLabel =
    ver?.versionName != null && ver?.versionCode != null
      ? `v${ver.versionName} (${ver.versionCode})${ver.commitSha ? ` · ${ver.commitSha}` : ""}`
      : null;

  return (
    <footer className="w-full border-t border-[color:var(--divider)] bg-[color:var(--bg)]">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-10">
        <div className="text-xs text-[color:var(--text-muted)]">
          No account required. High-protein recipes you generate and save in My recipes stay on this
          device (browser or app). We do not use them to build a profile on our servers.
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href={privacyHref} className="text-xs font-semibold text-[color:var(--accent)]">
            Privacy policy
          </a>
          {versionLabel ? (
            <span
              className="text-[11px] tabular-nums text-[color:var(--text-faint)]"
              title="Build identity from version.json (web deploy or AAB-embedded static export)"
            >
              {versionLabel}
            </span>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
