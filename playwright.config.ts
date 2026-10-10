/**
 * Browser tests (e2e/): the production build, served by `vite preview`, in
 * Chromium at a computer's width and a phone's. The build talks to a made-up
 * Supabase project, and every call to it is answered in the test itself
 * (e2e/fixtures.ts), so these tests never touch the live backend.
 *
 * Screenshot comparisons (e2e/screenshots.spec.ts) only run on Linux, where
 * their reference images are made: fonts render differently on a Mac. See
 * e2e/README.md.
 */
import { defineConfig } from "@playwright/test";

const PORT = 4317;

export default defineConfig({
  testDir: "e2e",
  // One folder of reference images, named by test and width, not by platform:
  // they are only ever made on Linux.
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}-{projectName}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  expect: {
    toHaveScreenshot: { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.001 },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "da-DK",
    timezoneId: "Europe/Copenhagen",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "computer",
      use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
    },
    {
      name: "phone",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    // Its own folder, so a test build never stands in for a real one in dist/.
    command: `npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      // Set here, these win over anything in .env.local (Vite never
      // overwrites variables already set).
      VITE_SUPABASE_URL: "https://test-project.supabase.co",
      VITE_SUPABASE_ANON_KEY: "test-publishable-key",
      VITE_TURNSTILE_SITE_KEY: "",
      VITE_APP_BUILD: "e2e",
    },
  },
});
