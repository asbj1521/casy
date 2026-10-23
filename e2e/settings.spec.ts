/**
 * Settings (#129): language and appearance are chosen under the profile, one
 * screen on a phone and a section of the page on a computer. The DA | EN
 * switch in the header is only for someone signed out, who has no profile.
 */
import { expect, test } from "./fixtures";

const SWITCH = { name: "Sprog" };

test.describe("signed in", () => {
  test("the header has no language switch on any page", async ({ page }) => {
    for (const path of ["/groups", "/events", "/calendar-overview", "/profile"]) {
      await page.goto(path);
      await expect(page.getByRole("link", { name: "casy" }).first()).toBeVisible();
      await expect(page.getByRole("radiogroup", SWITCH)).toHaveCount(0);
    }
  });

  test("a computer changes language in the profile, and it sticks", async ({ page, isMobile }) => {
    test.skip(isMobile, "computers only");
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Sprog" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Udseende" })).toBeVisible();
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { name: "Language" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Language" })).toBeVisible();
  });

  test("a phone opens Settings from the profile, and the way back is the profile", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phones only");
    await page.goto("/profile");
    // The profile itself is short: language and appearance live one step in.
    await expect(page.getByRole("heading", { name: "Udseende" })).toHaveCount(0);
    await page.getByRole("link", { name: /Indstillinger/ }).click();
    await expect(page).toHaveURL(/\/profile\/settings$/);
    await expect(page.getByRole("heading", { name: "Sprog" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Udseende" })).toBeVisible();

    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { name: "Language" })).toBeVisible();
    await page
      .getByRole("link", { name: /Profile/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("link", { name: /Settings/ })).toContainText("English");
  });

  test("a computer sent to the phone's settings address lands on the profile", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "computers only");
    await page.goto("/profile/settings");
    await expect(page).toHaveURL(/\/profile$/);
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
});
