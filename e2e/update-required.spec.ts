/**
 * An iPhone app older than the oldest release Casy still works with is asked
 * to update (#143): "Opdater Casy" over everything, signed in or not, with the
 * App Store's link. The website never asks, and a supported app sees nothing.
 */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "the app is a phone"));

/** The bridge the app injects before the page runs (src/lib/nativeApp.ts). */
async function asTheApp(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { Capacitor: object }).Capacitor = { isNativePlatform: () => true };
  });
}

test("an app older than the oldest supported release must update", async ({ page, backend }) => {
  backend.world.minAppVersion = "99.0.0";
  await asTheApp(page);
  await page.goto("/calendar-overview");
  const screen = page.getByRole("alertdialog", { name: "Opdater Casy" });
  await expect(screen).toBeVisible();
  await expect(screen.getByRole("link", { name: "Åbn App Store" })).toHaveAttribute(
    "href",
    "https://apps.apple.com/dk/app/casy/id0000000000",
  );
});

test("a supported app, and the website, are never asked", async ({ page, backend }) => {
  backend.world.minAppVersion = "1.0.0";
  await asTheApp(page);
  await page.goto("/calendar-overview");
  await expect(page.getByRole("button", { name: "Kalendere" })).toBeVisible();
  await expect(page.getByRole("alertdialog", { name: "Opdater Casy" })).toHaveCount(0);
});

test("the website is the latest, whatever the minimum", async ({ page, backend }) => {
  backend.world.minAppVersion = "99.0.0";
  await page.goto("/calendar-overview");
  await expect(page.getByRole("button", { name: "Kalendere" })).toBeVisible();
  await expect(page.getByRole("alertdialog", { name: "Opdater Casy" })).toHaveCount(0);
});
