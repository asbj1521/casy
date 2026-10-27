/**
 * The iPhone app's own first screen (#151): signed out, the app opens on a
 * welcome screen (the paper pile in small, one line, Kom i gang) with no tab
 * bar; sign-in and the privacy policy lead back to it. The website keeps its
 * landing page.
 */
import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

test.use({ signedIn: false });
test.beforeEach(({ isMobile }) => test.skip(!isMobile, "the app is a phone"));

/** The bridge the app injects before the page runs (src/lib/nativeApp.ts). */
async function asTheApp(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { Capacitor: object }).Capacitor = { isNativePlatform: () => true };
  });
}

test("the app opens on its welcome screen, which leads to sign-in and the legal pages and back", async ({
  page,
}) => {
  await asTheApp(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Find dagen, hvor alle kan." })).toBeVisible();
  // No tab bar and no website landing page before signing in.
  await expect(page.getByRole("link", { name: "Kalender" })).toHaveCount(0);
  await expect(page.getByText("Dine data, kort fortalt")).toHaveCount(0);

  await page.getByRole("link", { name: "Kom i gang" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  // Sign-in is the one way on: no back link, and no sentence about signing in (#138).
  await expect(page.getByRole("button", { name: "Tilbage" })).toHaveCount(0);
  await expect(page.getByText("Log ind for at forbinde dine kalendere")).toHaveCount(0);

  await page.goto("/");
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

test("every page the signed out app can open has a way back", async ({ page }) => {
  await asTheApp(page);
  for (const path of ["/how-it-works", "/terms", "/privacy", "/support"]) {
    await page.goto("/");
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Tilbage" })).toBeVisible();
  }
});

test("the app's sign-in has the email login on top and Apple, the default, under it (#138)", async ({
  page,
}) => {
  await asTheApp(page);
  await page.goto("/sign-in");
  const email = page.getByLabel("E-mail").first();
  const forgot = page.getByRole("button", { name: "Glemt adgangskode?" });
  const useLink = page.getByRole("button", { name: "Brug et e-mail-link i stedet" });
  const apple = page.getByRole("button", { name: "Fortsæt med Apple" });
  await expect(apple).toBeVisible();

  const y = async (locator: Locator) => (await locator.boundingBox())!.y;
  expect(await y(apple)).toBeGreaterThan(await y(email));
  expect(await y(apple)).toBeGreaterThan(await y(forgot));
  // The two small links share a row, forgot on the left.
  const [forgotBox, linkBox] = [await forgot.boundingBox(), await useLink.boundingBox()];
  expect(Math.abs(forgotBox!.y - linkBox!.y)).toBeLessThan(4);
  expect(forgotBox!.x).toBeLessThan(linkBox!.x);
});
