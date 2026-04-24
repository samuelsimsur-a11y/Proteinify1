/** True when running inside a native Capacitor shell (not the regular browser). */
export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  const C = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } })
    .Capacitor;
  if (!C) return false;
  // Prefer getPlatform(): remote `server.url` WebViews still report android/ios.
  if (typeof C.getPlatform === "function") {
    const p = C.getPlatform();
    if (p === "ios" || p === "android") return true;
    if (p === "web") return false;
  }
  if (typeof C.isNativePlatform === "function") {
    return C.isNativePlatform();
  }
  return false;
}
