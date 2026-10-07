/** The phone layout: the tab bar, and screens that open with a back button. */
import { expect, test } from "./fixtures";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "phones only"));

test("the tab bar reaches every main page", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByRole("navigation").last();
  for (const [tab, url] of [
    ["Grupper", /\/groups$/],
    ["Aftaler", /\/events$/],
    ["Kalender", /\/calendar-overview$/],
    ["Profil", /\/profile$/],
  ] as const) {
    await tabs.getByRole("link", { name: tab }).click();
    await expect(page).toHaveURL(url);
  }
  await tabs.getByRole("link", { name: "Planlæg" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("the profile's screens open and go back", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("link", { name: "Log ind og sikkerhed" }).click();
  await expect(page).toHaveURL(/\/profile\/password$/);
  await page
    .getByRole("link", { name: /Profil/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/profile$/);
});
