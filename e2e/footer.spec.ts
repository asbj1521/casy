/**
 * The site's footer (how it works, terms, privacy): on a computer always, on a
 * phone only while signed out. Signed in, the phone's profile lists the same
 * links, and a footer under a short page showed up above the tab bar on some
 * pages and not on others.
 */
import { expect, test } from "./fixtures";

const PRIVACY = { name: "Privatliv", exact: true };

test.describe("signed in", () => {
  test("the footer is there on a computer, on every page", async ({ page, isMobile }) => {
    test.skip(isMobile, "computers only");
    for (const path of ["/groups", "/events", "/calendar-overview"]) {
      await page.goto(path);
      await expect(page.getByRole("link", PRIVACY)).toBeVisible();
    }
  });

  test("a phone has none, whatever the page, and the profile has the links", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phones only");
    for (const path of ["/groups", "/events", "/"]) {
      await page.goto(path);
      await expect(
        page
          .getByRole("main")
          .or(page.getByRole("dialog"))
          .or(page.getByRole("button", { name: "Planlæg" }))
          .first(),
      ).toBeVisible();
      await expect(page.getByRole("contentinfo")).toHaveCount(0);
    }
    await page.goto("/profile");
    await expect(page.getByRole("link", { name: "Privatliv" })).toBeVisible();
  });
});

test.describe("signed out", () => {
  test.use({ signedIn: false });

  test("the footer is there, phone and computer alike: the home page needs the privacy link", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("contentinfo").getByRole("link", PRIVACY)).toBeVisible();
  });
});
