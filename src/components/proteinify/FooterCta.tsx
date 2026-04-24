"use client";

import { getAppRouteHref } from "@/lib/navigation/appRoutes";

export default function FooterCta() {
  const privacyHref = getAppRouteHref("privacy");

  return (
    <footer className="w-full border-t border-[color:var(--divider)] bg-[color:var(--bg)]">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-10">
        <div className="text-xs text-[color:var(--text-muted)]">
          No account required. High-protein recipes you generate and save in My recipes stay in this
          browser on your device. We do not use them to build a profile on our servers.
        </div>
        <a href={privacyHref} className="text-xs font-semibold text-[color:var(--accent)]">
          Privacy policy
        </a>
      </div>
    </footer>
  );
}

