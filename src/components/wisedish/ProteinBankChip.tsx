"use client";

import { useEffect, useState } from "react";
import { COOK_LOG_EVENT, computeStats, getCookLog, initCookLogNativeStorage, type ProteinBankStats } from "@/lib/cookLog";
import { getAppRouteHref } from "@/lib/navigation/appRoutes";

/** Small "Protein Bank" progress line — appears once the cook has logged at least one dish. */
export default function ProteinBankChip() {
  const [stats, setStats] = useState<ProteinBankStats | null>(null);

  useEffect(() => {
    const refresh = () => setStats(computeStats(getCookLog()));
    void initCookLogNativeStorage().then(refresh);
    window.addEventListener(COOK_LOG_EVENT, refresh);
    return () => window.removeEventListener(COOK_LOG_EVENT, refresh);
  }, []);

  if (!stats || stats.dishesCooked === 0) return null;

  return (
    <a
      href={getAppRouteHref("log")}
      className="self-center inline-flex min-h-9 items-center gap-2 rounded-full border border-[color:var(--divider)] bg-[color:var(--surface-offset)] px-3 text-[11px] font-semibold text-[color:var(--text-primary)]"
    >
      <span aria-hidden>🏦</span>
      Protein Bank: {stats.totalAddedG}g
      {stats.weekStreak > 1 ? <span>· 🔥 {stats.weekStreak} weeks</span> : null}
      {stats.nextMilestoneG ? (
        <span className="text-[color:var(--text-muted)]">· next badge {stats.nextMilestoneG}g</span>
      ) : null}
    </a>
  );
}
