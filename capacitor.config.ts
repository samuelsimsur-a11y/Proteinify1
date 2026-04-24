import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ca.foodzap.app',
  appName: 'Wise Dish',
  // Local-first static bundle. Do not set server.url unless intentionally running remote-web mode.
  webDir: 'out',
};

export default config;
