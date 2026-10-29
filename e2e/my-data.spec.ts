/** Your data: reached from the profile, and downloaded as a file. */
import { expect, test } from "./fixtures";

test("the profile opens Your data, which downloads as JSON", async ({ page, isMobile }) => {
  await page.goto("/profile");
  await page.getByRole("link", { name: "Dine data" }).click();
  // A phone opens it inside the Profil sheet (#174).
  await expect(page).toHaveURL(isMobile ? /\?profile=data$/ : /\/profile\/data$/);
  const data = isMobile ? page.getByRole("dialog") : page;
  await expect(data.getByText("mia@icloud.com").first()).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Hent en kopi/ }).click();
  expect((await download).suggestedFilename()).toBe("casy-data-2026-10-07.json");
});

test("a long list of accounts and calendars is folded behind one row", async ({
  page,
  isMobile,
}) => {
  await page.goto("/profile/data");
  // A phone's is in the Profil sheet over the month, whose chips say "Familie" too.
  const data = isMobile ? page.getByRole("dialog") : page;
  const fold = data.getByRole("button", { name: /^\d+ konti, \d+ kalendere$/ });
  await expect(fold).toHaveAttribute("aria-expanded", "false");
  await expect(data.getByText("Familie", { exact: true })).toHaveCount(0);

  await fold.click();
  await expect(fold).toHaveAttribute("aria-expanded", "true");
  await expect(data.getByText("Familie", { exact: true })).toBeVisible();

  await fold.click();
  await expect(data.getByText("Familie", { exact: true })).toHaveCount(0);
});

test("a short list stays as it is: no fold for a few groups", async ({ page }) => {
  await page.goto("/profile/data");
  await expect(page.getByRole("button", { name: /^\d+ grupper$/ })).toHaveCount(0);
});
