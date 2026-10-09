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

test("My calendar is a month like Apple's: a day opens its busy time, Kalendere the list", async ({
  page,
}) => {
  await page.goto("/calendar-overview");
  // A tapped day's busy time slides up with the month still live behind it:
  // another day can be tapped at once, and a blank part of the month closes it.
  await page.getByRole("button", { name: "torsdag 1. oktober" }).click();
  await expect(page.getByRole("region", { name: "Torsdag 1. oktober" })).toBeVisible();
  await page.getByRole("button", { name: "fredag 2. oktober" }).click();
  await expect(page.getByRole("region", { name: "Fredag 2. oktober" })).toBeVisible();
  await page.getByRole("heading", { name: "Oktober", exact: true }).click();
  await expect(page.getByRole("region", { name: "Fredag 2. oktober" })).toBeHidden();

  await page.getByRole("button", { name: "Kalendere" }).click();
  await expect(page.getByRole("heading", { name: "Dine kalendere" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Forbundne kalendere/ })).toBeVisible();

  // One step back from "Connected calendars" lands on the sheet, not the bare month.
  await page.getByRole("link", { name: /Forbundne kalendere/ }).click();
  await expect(page).toHaveURL(/\/calendar-overview\/accounts$/);
  await page.getByRole("link", { name: "Kalender" }).first().click();
  await expect(page.getByRole("heading", { name: "Dine kalendere" })).toBeVisible();
});

test.describe("short pages", () => {
  test.use({ world: { calendars: "connected", groups: "none" } });

  test("a page with little on it doesn't scroll into nothing", async ({ page }) => {
    // The tab bar's room and the footer used to come on top of a page a whole
    // screen tall, so a short page could be scrolled by that much.
    for (const path of ["/groups", "/events"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const { scroll, screen } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollHeight,
        screen: window.innerHeight,
      }));
      expect(scroll, path).toBeLessThanOrEqual(screen);
    }
  });
});
