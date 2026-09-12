import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5174",
    headless: true,
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
    env: {
      VITE_PUBLIC_INTAKE_URL: "http://127.0.0.1:5174/test-intake",
      VITE_TURNSTILE_SITE_KEY: "browser-test-only",
      VITE_GOOGLE_MAPS_API_KEY: "browser-test-only",
      VITE_FIREBASE_API_KEY: "demo-roofzeus-local-preview",
      VITE_FIREBASE_PROJECT_ID: "demo-roofzeus",
      VITE_FIREBASE_AUTH_DOMAIN: "localhost",
    },
  },
});
