/** Your data: reached from the profile, and downloaded as a file. */
import { expect, test } from "./fixtures";

test("the profile opens Your data, which downloads as JSON", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("link", { name: "Dine data" }).click();
  await expect(page).toHaveURL(/\/profile\/data$/);
  await expect(page.getByText("mia@icloud.com").first()).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Hent en kopi/ }).click();
  expect((await download).suggestedFilename()).toBe("casy-data-2026-10-07.json");
});

test("a long list of accounts and calendars is folded behind one row", async ({ page }) => {
  await page.goto("/profile/data");
  const fold = page.getByRole("button", { name: /^\d+ konti, \d+ kalendere$/ });
  await expect(fold).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("Familie", { exact: true })).toHaveCount(0);

  await fold.click();
  await expect(fold).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Familie", { exact: true })).toBeVisible();

  await fold.click();
  await expect(page.getByText("Familie", { exact: true })).toHaveCount(0);
});

test("a short list stays as it is: no fold for a few groups", async ({ page }) => {
  await page.goto("/profile/data");
  await expect(page.getByRole("button", { name: /^\d+ grupper$/ })).toHaveCount(0);
});
