/**
 * The iPhone app's own first screen (#151): signed out, the app opens on a
 * welcome screen (the paper pile in small, one line, Kom i gang) with no tab
 * bar; sign-in and the privacy policy lead back to it. The website keeps its
 * landing page.
 */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

test.use({ signedIn: false });
test.beforeEach(({ isMobile }) => test.skip(!isMobile, "the app is a phone"));

/** The bridge the app injects before the page runs (src/lib/nativeApp.ts). */
async function asTheApp(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { Capacitor: object }).Capacitor = { isNativePlatform: () => true };
  });
}

test("the app opens on its welcome screen, which leads to sign-in and back", async ({ page }) => {
  await asTheApp(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Find dagen, hvor alle kan." })).toBeVisible();
  // No tab bar and no website landing page before signing in.
  await expect(page.getByRole("link", { name: "Kalender" })).toHaveCount(0);
  await expect(page.getByText("Dine data, kort fortalt")).toHaveCount(0);

  await page.getByRole("link", { name: "Kom i gang" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByRole("button", { name: "Tilbage" }).click();
  await expect(page.getByRole("heading", { name: "Find dagen, hvor alle kan." })).toBeVisible();

  await page.getByRole("link", { name: "Sådan passer Casy på dine data" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await page.getByRole("button", { name: "Tilbage" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("the website keeps its landing page and tab bar", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Find dagen, hvor alle kan." })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Kalender" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tilbage" })).toHaveCount(0);
});
