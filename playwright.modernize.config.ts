import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/modernize-browser",
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:5175",
    headless: true,
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175 --strictPort",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
    env: {
      VITE_LEAD_DELIVERY: "modernize",
      VITE_MODERNIZE_GATEWAY_URL: "http://127.0.0.1:5175/modernize-test",
      VITE_TURNSTILE_SITE_KEY: "browser-test-only",
      VITE_GOOGLE_MAPS_API_KEY: "",
    },
  },
});
