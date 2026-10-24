/**
 * What #157 split into chunks loaded on demand must still hold together:
 * English arrives before the page switches to it, and a page opened before a
 * deploy that asks for code which is gone reloads once, then shows the
 * crash screen rather than a blank page.
 */
import { expect, test } from "./fixtures";

test.describe("signed out", () => {
  test.use({ signedIn: false });

  test("switching to English loads it, and the page is drawn in English", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Hvornår kan I?")).toBeVisible();
    await page.getByRole("radio", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByText("Hvornår kan I?")).toHaveCount(0);
  });

  test("a page opened in English starts in English", async ({ page }) => {
    await page.goto("/?lang=en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Hvornår kan I?")).toHaveCount(0);
  });
});

test.describe("a deploy under an open page", () => {
  // The missing file is thrown as an error in the page, on purpose.
  test.use({ expectPageErrors: true });

  test("code that is gone reloads the page once, then shows the crash screen", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the computer's header link is the way in");
    await page.goto("/profile");
    await expect(page.getByRole("link", { name: /Mine aftaler/ }).first()).toBeVisible();
    // As after a deploy: My events' code file no longer exists.
    await page.route(/\/assets\/MyEvents-[^/]+\.js$/, (route) => route.fulfill({ status: 404 }));
    let loads = 0;
    page.on("load", () => loads++);
    await page
      .getByRole("link", { name: /Mine aftaler/ })
      .first()
      .click();
    await expect(page.getByText("Noget gik galt.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Indlæs siden igen" })).toBeVisible();
    expect(loads).toBe(1);
  });
});
