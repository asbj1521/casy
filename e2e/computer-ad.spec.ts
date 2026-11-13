/**
 * What a computer sees instead of the website (#270): the app's ad, with the
 * joke playing on a phone, a QR code and the ways to the app. A phone never
 * sees it. The rest of the browser tests keep the old computer site
 * (`computerSite` in fixtures.ts) until #273 removes it.
 */
import { expect, test } from "./fixtures";

test.use({ computerSite: false });

test.describe("a computer", () => {
  test.skip(({ isMobile }) => isMobile, "a phone keeps the website");

  test.describe("signed out", () => {
    test.use({ signedIn: false });

    test("sees the ad on every address of the app, with a code to the app", async ({ page }) => {
      for (const path of ["/", "/plan", "/groups", "/profile", "/nowhere"]) {
        await page.goto(path);
        await expect(page.getByText("Det siger alle. Appen finder den så.")).toBeVisible();
      }
      await expect(page.getByRole("img", { name: "QR-kode til appen" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Hent i App Store" })).toHaveAttribute(
        "href",
        "https://apps.apple.com/app/id6830713238",
      );
      await expect(
        page.getByText("Ud fra jeres kalendere, gratis på alle telefoner."),
      ).toBeVisible();
      // The phone plays by itself: the app's first line comes once the plan has stalled.
      await expect(page.getByText("Er det også sket for dig?")).toBeVisible({ timeout: 20_000 });
    });

    test("keeps the privacy policy, the terms and the help pages as they are", async ({ page }) => {
      await page.goto("/privacy");
      await expect(page.getByRole("heading", { name: "Det gemmer vi" })).toBeVisible();
      await expect(page.getByText("Det siger alle. Appen finder den så.")).toHaveCount(0);
      await page.goto("/help/connect-ics");
      await expect(page.getByText("Det siger alle. Appen finder den så.")).toHaveCount(0);
    });

    test("an invite link says who invited you, and its code is that link", async ({ page }) => {
      await page.goto("/join/a-token");
      await expect(page.getByText("Sara har inviteret dig til Sommerhuset")).toBeVisible();
      await expect(page.getByText("Scan med din telefon for at være med")).toBeVisible();
      await expect(page.getByRole("img", { name: "QR-kode til invitationen" })).toBeVisible();
    });

    test("sign-in typed in is the ad; only an email's link opens it", async ({ page }) => {
      await page.goto("/sign-in");
      await expect(page.getByText("Det siger alle. Appen finder den så.")).toBeVisible();
    });

    test("speaks English too", async ({ page }) => {
      await page.goto("/?lang=en");
      await expect(page.getByText("Everyone says it. The app actually finds it.")).toBeVisible();
      await expect(page.getByRole("link", { name: "Get it on the App Store" })).toBeVisible();
    });
  });

  test("signed in, says so, and can sign out on a shared computer", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText(/^Logget ind som .+\. Fortsæt i appen på telefonen\./),
    ).toBeVisible();
    await page.getByRole("button", { name: "Log ud" }).click();
    await expect(page.getByText(/^Logget ind som/)).toHaveCount(0);
  });
});

test("a phone keeps the website, never the ad", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone's own");
  await page.goto("/");
  await expect(page.getByText("Det siger alle. Appen finder den så.")).toHaveCount(0);
});
