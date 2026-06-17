import type { CapacitorConfig } from "@capacitor/cli";
import { resolveProductionOrigin } from "./src/lib/wisedish/productionOrigin";

/**
 * Release Android/iOS builds: bundle static `out/` locally — UI loads offline.
 * API calls use `apiBaseUrl.ts` → production HTTPS when online.
 *
 * Dev live-reload: set CAPACITOR_SERVER_URL=http://localhost:3000 (or your LAN IP).
 */
const liveReloadUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  (process.env.CAPACITOR_USE_REMOTE === "true" ? resolveProductionOrigin() : "");

const config: CapacitorConfig = {
  appId: "com.wisedish.app",
  appName: "Wise Dish",
  webDir: "out",
  ...(liveReloadUrl
    ? {
        server: {
          url: liveReloadUrl,
          cleartext: liveReloadUrl.startsWith("http://"),
          androidScheme: "https",
        },
      }
    : {}),
};

export default config;
