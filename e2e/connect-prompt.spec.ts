/**
 * "Connect your calendar": a computer asks someone with no calendar in a
 * pop-up, once per visit (ConnectCalendarPrompt); a phone never shows it.
 */
import { expect, test } from "./fixtures";

test.use({ world: { calendars: "none", groups: "some" } });

const dialog = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog", { name: "Forbind din kalender" });

test("asks once, and stays closed for the visit", async ({ page, isMobile }) => {
  test.skip(isMobile, "computers only");
  await page.goto("/");
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole("button", { name: "Ikke nu" }).click();
  await expect(dialog(page)).toBeHidden();

  await page.getByRole("link", { name: "Mine aftaler" }).click();
  await expect(page.getByRole("heading", { name: "Mine aftaler" })).toBeVisible();
  await expect(dialog(page)).toBeHidden();
});

for (const choice of ["Apple-kalender", "Kalenderlink (ICS)"]) {
  test(`choosing ${choice} opens its form on the calendars page`, async ({ page, isMobile }) => {
    test.skip(isMobile, "computers only");
    await page.goto("/");
    await dialog(page).getByRole("button", { name: choice }).click();
    // The page reads ?connect= and tidies it away.
    await expect(page).toHaveURL(/\/calendar-overview\/accounts$/);
    await expect(page.getByRole("heading", { level: 3, name: choice })).toBeVisible();
  });
}

test("a phone isn't asked with a pop-up", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phones only");
  await page.goto("/");
  await expect(page.getByText("Første dato", { exact: false })).toBeVisible();
  await expect(dialog(page)).toBeHidden();
});
