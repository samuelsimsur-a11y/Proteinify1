import { isCapacitorNative } from "@/lib/capacitorEnv";

export type AppRouteKey = "home" | "log" | "feedback" | "privacy";

const WEB_ROUTES: Record<AppRouteKey, string> = {
  home: "/",
  log: "/log",
  feedback: "/feedback",
  privacy: "/privacy",
};

const NATIVE_STATIC_ROUTES: Record<AppRouteKey, string> = {
  home: "/index.html",
  log: "/log.html",
  feedback: "/feedback.html",
  privacy: "/privacy.html",
};

/** Returns the safest route target for the current runtime (web vs Capacitor static bundle). */
export function getAppRouteHref(route: AppRouteKey): string {
  if (isCapacitorNative()) return NATIVE_STATIC_ROUTES[route];
  return WEB_ROUTES[route];
}
