/**
 * The sign-in page. The iPhone app has no Google button (#91): with one, App
 * Store guideline 4.8 asks for another sign-in service beside it; without,
 * the app signs in only with Casy's own accounts.
 */
import { expect, test } from "./fixtures";

test.use({ signedIn: false });

test("the website offers Google beside email", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: "Fortsæt med Google" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
});

test("the iPhone app offers Apple and Casy's own sign-in, never Google", async ({ page }) => {
  // The bridge the app injects before the page runs (src/lib/nativeApp.ts).
  await page.addInitScript(() => {
    (window as unknown as { Capacitor: object }).Capacitor = { isNativePlatform: () => true };
  });
  await page.goto("/sign-in");
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fortsæt med Google" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Fortsæt med Apple" })).toBeVisible();
});
