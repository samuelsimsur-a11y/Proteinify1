import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Production URL for the Wise Dish web app (HTTPS). The Android WebView loads this host;
 * keep it aligned with Vercel deployment and `NEXT_PUBLIC_SITE_URL` where possible.
 */
function productionWebUrl(): string {
  const site =
    process.env.CAPACITOR_SERVER_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "";
  if (site) {
    return site.endsWith("/") ? site.slice(0, -1) : site;
  }
  return "https://foodzap-khaki.vercel.app";
}

const config: CapacitorConfig = {
  appId: "com.wisedish.app",
  appName: "Wise Dish",
  webDir: "out",
  server: {
    url: productionWebUrl(),
    cleartext: false,
    androidScheme: "https",
  },
};

export default config;
