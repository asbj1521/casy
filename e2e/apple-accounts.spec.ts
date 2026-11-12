/** One account, however someone signs in (#245): a first Apple sign-in asks, and Apple can be added. */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { NOW } from "./world";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "the app is a phone"));

/** The app, with iOS's Apple sheet answering at once. */
const asTheApp = (page: Page) =>
  page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).Capacitor = {
      isNativePlatform: () => true,
      PluginHeaders: [{ name: "AppleSignIn", methods: [{ name: "signIn", rtype: "promise" }] }],
      nativeCallback: async () => "listener",
      nativePromise: async () => ({
        identityToken: "apple-token",
        authorizationCode: "apple-code",
        nonce: "nonce",
        givenName: "",
        familyName: "",
      }),
    };
  });

/** An account Apple's sign-in has just made: new, Apple its only way in. */
const justMade = {
  created_at: new Date(NOW).toISOString(),
  identities: [{ id: "apple-1", provider: "apple", identity_id: "apple-1" }],
  app_metadata: { provider: "apple", providers: ["apple"] },
};

test.describe("signing in with Apple", () => {
  test.use({ signedIn: false });

  test("a new account is asked first, and a yes takes the old way in instead", async ({
    page,
    backend,
  }) => {
    backend.appleUser = justMade;
    await asTheApp(page);
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Fortsæt med Apple" }).click();

    const ask = page.getByRole("dialog", { name: "Har du allerede en konto?" });
    await expect(ask).toBeVisible();
    await ask.getByRole("button", { name: "Ja, jeg har en konto" }).click();
    // The empty account just made is deleted, and the way in told.
    await expect
      .poll(() => backend.calls.some((c) => c.name === "account" && c.body.action === "delete"))
      .toBe(true);
    await expect(page.getByText(/^Log ind på den måde, du gjorde før/)).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("someone new goes on as before", async ({ page, backend }) => {
    backend.appleUser = justMade;
    await asTheApp(page);
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Fortsæt med Apple" }).click();
    await page
      .getByRole("dialog", { name: "Har du allerede en konto?" })
      .getByRole("button", { name: "Nej, jeg er ny" })
      .click();
    await expect(page).not.toHaveURL(/\/sign-in/);
    expect(backend.calls.some((c) => c.name === "account" && c.body.action === "delete")).toBe(
      false,
    );
  });

  test("an account Apple was already a way into is not asked about", async ({ page, backend }) => {
    backend.appleUser = { ...justMade, created_at: "2026-09-01T10:00:00.000Z" };
    await asTheApp(page);
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Fortsæt med Apple" }).click();
    await expect(page).not.toHaveURL(/\/sign-in/);
    await expect(page.getByRole("dialog", { name: "Har du allerede en konto?" })).toHaveCount(0);
  });
});

test("Apple is added under Log ind og sikkerhed, and says so", async ({ page }) => {
  await asTheApp(page);
  await page.goto("/?profile=password");
  const row = page.getByRole("button", { name: /Log ind med Apple/ });
  await expect(row).toContainText("Tilføj");
  await row.click();
  await expect(page.getByText("Tilføjet", { exact: true })).toBeVisible();
});

test("an Apple ID that is another account's way in is said plainly", async ({ page, backend }) => {
  backend.appleFails = { error_code: "identity_already_exists", msg: "Identity is already linked" };
  await asTheApp(page);
  await page.goto("/?profile=password");
  await page.getByRole("button", { name: /Log ind med Apple/ }).click();
  await expect(page.getByText("Det Apple-id hører allerede til en anden konto.")).toBeVisible();
});

test("the website has no Apple row", async ({ page }) => {
  await page.goto("/?profile=password");
  await expect(page.getByRole("heading", { name: "Log ind og sikkerhed" }).first()).toBeVisible();
  await expect(page.getByText("Log ind med Apple")).toHaveCount(0);
});
