/**
 * The iPhone app's own first screen (#151): signed out, the app opens on a
 * welcome screen (a phone playing the app, #228; one line, Kom i gang, Log ind)
 * with no tab bar; sign-in leads back to it, the privacy policy to sign-in. The website keeps
 * its landing page.
 */
import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

test.use({ signedIn: false });
test.beforeEach(({ isMobile }) => test.skip(!isMobile, "the app is a phone"));

/**
 * The bridge the app injects before the page runs (src/lib/nativeApp.ts). By
 * default someone who has played the welcome's journey before (#275), so Kom i
 * gang is there at once.
 */
async function asTheApp(page: Page, { seen = true }: { seen?: boolean } = {}) {
  await page.addInitScript((seen) => {
    (window as unknown as { Capacitor: object }).Capacitor = { isNativePlatform: () => true };
    if (seen) localStorage.setItem("casy-welcome-seen", "1");
  }, seen);
}

test("the first time, only Log ind shows until the journey has been played (#275)", async ({
  page,
}) => {
  await asTheApp(page, { seen: false });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Log ind" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kom i gang" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Indsæt link" })).toHaveCount(0);
  // It opens on the question, the phone's screen orange.
  await expect(page.getByText("Er det også sket for dig?")).toBeVisible();
});

test("the app opens on its welcome screen, which leads to sign-in and the legal pages and back", async ({
  page,
}) => {
  await asTheApp(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Vi finder lige en dag" })).toBeVisible();
  // No tab bar and no website landing page before signing in.
  await expect(page.getByRole("link", { name: "Kalender" })).toHaveCount(0);
  await expect(page.getByText("Dine data, kort fortalt")).toHaveCount(0);

  // Kom i gang opens the sign-up tab, Log ind the log-in tab.
  await page.getByRole("link", { name: "Log ind" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/");
  await page.getByRole("link", { name: "Kom i gang" }).click();
  await expect(page).toHaveURL(/\/sign-in\?signup=1$/);
  // No sentence about signing in (#138), and a way back to the animation (#228).
  await expect(page.getByText("Log ind for at forbinde dine kalendere")).toHaveCount(0);
  await page.getByRole("button", { name: "Tilbage" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Vi finder lige en dag" })).toBeVisible();

  // The privacy policy is not on the welcome screen: it is under the sign-in
  // card, and on the profile once signed in.
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Sådan passer vi på dine data" })).toHaveCount(0);
  await page.getByRole("link", { name: "Kom i gang" }).click();
  await page.getByRole("link", { name: "privatlivspolitik" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await page.getByRole("button", { name: "Tilbage" }).click();
  await expect(page).toHaveURL(/\/sign-in\?signup=1$/);
});

test("the website keeps its landing page, and its header leads to sign-in (#169)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Vi finder lige en dag" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tilbage" })).toHaveCount(0);
  await page.goto("/privacy");
  await page.getByRole("banner").getByRole("link", { name: "Log ind" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("every page the signed out app can open has a way back", async ({ page }) => {
  await asTheApp(page);
  for (const path of ["/how-it-works", "/terms", "/privacy", "/support"]) {
    await page.goto("/");
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Tilbage" })).toBeVisible();
  }
});

test("the app's sign-in has Apple, the one-tap way in, on top and the email login under it (#212)", async ({
  page,
}) => {
  await asTheApp(page);
  await page.goto("/sign-in");
  const email = page.getByLabel("E-mail").first();
  const forgot = page.getByRole("button", { name: "Glemt adgangskode?" });
  const useLink = page.getByRole("button", { name: "Brug et e-mail-link i stedet" });
  const apple = page.getByRole("button", { name: "Fortsæt med Apple" });
  await expect(apple).toBeVisible();

  const y = async (locator: Locator) => (await locator.boundingBox())!.y;
  expect(await y(apple)).toBeLessThan(await y(email));
  expect(await y(apple)).toBeLessThan(await y(forgot));
  // The two small links share a row, forgot on the left.
  const [forgotBox, linkBox] = [await forgot.boundingBox(), await useLink.boundingBox()];
  expect(Math.abs(forgotBox!.y - linkBox!.y)).toBeLessThan(4);
  expect(forgotBox!.x).toBeLessThan(linkBox!.x);
});

/** What is copied on the phone, as the app's clipboard would hand it over. */
async function copied(page: Page, text: string | null) {
  await page.addInitScript((value) => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        readText: () => (value === null ? Promise.reject(new Error("no")) : Promise.resolve(value)),
      },
    });
  }, text);
}

test("a friend who got the app from an invite hands it the link, and is at the invite (#237)", async ({
  page,
}) => {
  await asTheApp(page);
  // What Hent appen copied on the invite page, among a chat's own words.
  await copied(page, "Kom med: https://casy.app/join/a-token");
  await page.goto("/");
  await expect(page.getByText("Fik du en invitation?")).toBeVisible();
  await page.getByRole("button", { name: "Indsæt link" }).click();
  const sheet = page.getByRole("dialog", { name: "Invitation" });
  await sheet.getByRole("button", { name: "Indsæt link" }).click();
  await expect(page).toHaveURL(/\/join\/a-token$/);
  await expect(page.getByRole("heading", { name: "Sara har inviteret dig til" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bliv medlem" })).toBeVisible();
});

test("with no invite copied, the link is pasted into the field by hand (#237)", async ({
  page,
}) => {
  await asTheApp(page);
  await copied(page, "noget helt andet");
  await page.goto("/");
  await page.getByRole("button", { name: "Indsæt link" }).click();
  const sheet = page.getByRole("dialog", { name: "Invitation" });
  await sheet.getByRole("button", { name: "Indsæt link" }).click();
  // Nothing copied is shown; it only says there was no invite in it.
  await expect(sheet.getByText(/^Intet invitationslink fundet\./)).toBeVisible();
  await expect(sheet.getByRole("textbox", { name: "Invitationslink" })).toHaveValue("");
  await sheet
    .getByRole("textbox", { name: "Invitationslink" })
    .fill("https://casy.app/join/a-token");
  await sheet.getByRole("button", { name: "Åbn invitation" }).click();
  await expect(page).toHaveURL(/\/join\/a-token$/);
});
