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
