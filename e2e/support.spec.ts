/**
 * Help and contact (#146): /support is the App Store's support URL, so it opens
 * signed out too, and the profile's help list leads to it.
 */
import { expect, test } from "./fixtures";

test("the profile's help list leads to the support page", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("link", { name: "Hjælp og kontakt" }).click();
  await expect(page).toHaveURL(/\/support$/);
  await expect(page.getByRole("heading", { name: "Hjælp og kontakt", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "asbjornbay@gmail.com" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Slet min konto" })).toBeVisible();
});

test.describe("signed out", () => {
  test.use({ signedIn: false });

  test("the support page needs no login, and speaks English on request", async ({ page }) => {
    await page.goto("/support?lang=en");
    await expect(page.getByRole("heading", { name: "Help and contact", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Report and block" })).toBeVisible();
  });
});
