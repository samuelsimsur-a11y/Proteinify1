"use client";

import { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 border-b border-amber-300/80 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-950"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      You&apos;re offline — saved recipes work; generation needs a connection.
    </div>
  );
}
