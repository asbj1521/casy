/**
 * Settings (#129): language and light or dark are chosen under the profile,
 * the same on a phone, a computer and in the iPhone app. The DA | EN switch in
 * the header is only for someone signed out, who has no profile.
 */
import { expect, test } from "./fixtures";

const SWITCH = { name: "Sprog" };

test.describe("signed in", () => {
  test("the header has no language switch on any page", async ({ page }) => {
    for (const path of ["/events", "/calendar-overview", "/profile"]) {
      await page.goto(path);
      await expect(page.getByRole("link", { name: "casy" }).first()).toBeVisible();
      await expect(page.getByRole("radiogroup", SWITCH)).toHaveCount(0);
    }
  });

  test("the profile has a Settings button, and not the choices themselves", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Udseende" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Sprog" })).toHaveCount(0);
    await page.getByRole("link", { name: /Indstillinger/ }).click();
    await expect(page).toHaveURL(/\/profile\/settings$/);
    await expect(page.getByRole("heading", { name: "Sprog" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Udseende" })).toBeVisible();
  });

  test("language is changed there, sticks, and the way back is the profile", async ({ page }) => {
    await page.goto("/profile/settings");
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { name: "Language" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Language" })).toBeVisible();
    await page
      .getByRole("link", { name: /Profile/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("link", { name: /Settings/ })).toContainText("English");
  });

  test("dark and light are chosen there too, and the page follows", async ({ page }) => {
    await page.goto("/profile/settings");
    const html = page.locator("html");
    await page.getByRole("button", { name: "Mørk" }).click();
    await expect(html).toHaveClass(/theme-dark/);
    await page.getByRole("button", { name: "Lys" }).click();
    await expect(html).toHaveClass(/theme-light/);
    await page.getByRole("button", { name: "Følg systemet" }).click();
    await expect(html).not.toHaveClass(/theme-(light|dark)/);
  });

  test("the iPhone app has the choice too", async ({ page }) => {
    // The bridge the app injects before the page runs (src/lib/nativeApp.ts).
    await page.addInitScript(() => {
      (window as unknown as { Capacitor: object }).Capacitor = { isNativePlatform: () => true };
    });
    await page.goto("/profile/settings");
    await expect(page.getByRole("heading", { name: "Udseende" })).toBeVisible();
    await page.getByRole("button", { name: "Mørk" }).click();
    await expect(page.locator("html")).toHaveClass(/theme-dark/);
  });
});

test.describe("signed out", () => {
  test.use({ signedIn: false });

  test("the header keeps the switch, since there is no profile to choose in", async ({ page }) => {
    await page.goto("/");
    const group = page.getByRole("radiogroup", SWITCH);
    await expect(group).toBeVisible();
    await group.getByRole("radio", { name: "English" }).click();
    await expect(page.getByRole("radiogroup", { name: "Language" })).toBeVisible();
  });

  test("Settings needs a login", async ({ page }) => {
    await page.goto("/profile/settings");
    await expect(page).not.toHaveURL(/\/profile\/settings$/);
  });
});
