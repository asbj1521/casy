/** My groups: the list, one group, and an invitation. */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

test("a group opens with its members", async ({ page, isMobile }) => {
  await page.goto("/groups");
  await page
    .getByRole("link", { name: /Løbeklubben/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/groups\/g-running$/);
  for (const name of ["Freja", "Oliver"]) {
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }
  if (isMobile) {
    // A screen of its own, with a way back.
    await page
      .getByRole("link", { name: /Grupper/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/groups$/);
  }
});

test("declining an invitation removes it", async ({ page, backend }) => {
  await page.goto("/groups");
  await expect(page.getByText("Badminton")).toBeVisible();
  await page.getByRole("button", { name: "Nej tak" }).click();
  await expect(page.getByText("Badminton")).toBeHidden();
  expect(backend.calls.find((c) => c.body.action === "decline-invitation")?.body).toMatchObject({
    groupId: "g-badminton",
  });
});

test("a group's invite link can be shown as a QR code to scan (#150)", async ({ page }) => {
  await page.goto("/groups/g-running");
  await page
    .getByRole("button", { name: /Invitér folk/ })
    .first()
    .click();
  // The code needs a link, so asking for it makes one.
  await page.getByRole("button", { name: "Vis QR-kode" }).click();
  await expect(
    page.getByRole("img", { name: /QR-kode til at blive medlem af Løbeklubben/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox").or(page.getByText("https://casy.app/join/test-invite-token")).first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Skjul QR-kode" }).click();
  await expect(page.getByRole("img", { name: /QR-kode/ })).toHaveCount(0);
});

test("a new group with nobody invited goes straight to inviting (#149)", async ({ page }) => {
  await page.goto("/groups");
  await page.getByRole("button", { name: "Lav en gruppe" }).click();
  await page.getByLabel("Gruppenavn").fill("Fredagsfilm");
  await page.getByRole("button", { name: "Opret gruppe" }).click();
  await expect(page).toHaveURL(/\/groups\/g-new-\d+\?invite$/);
  await expect(page.getByRole("heading", { name: "Invitér til Fredagsfilm" })).toBeVisible();
  // Closed, it is an ordinary group page again: a reload doesn't reopen it.
  await page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: "Invitér til Fredagsfilm" }) })
    .getByRole("button", { name: "Annuller" })
    .click();
  await expect(page).toHaveURL(/\/groups\/g-new-\d+$/);
});

/**
 * The app's Invite plugin, answering for iOS: two people picked, Messages
 * available, and what Messages was given kept for the test to read.
 */
async function asTheAppWithContacts(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.Capacitor = {
      isNativePlatform: () => true,
      PluginHeaders: [
        {
          name: "Invite",
          methods: ["pickContacts", "canText", "text"].map((name) => ({
            name,
            rtype: "promise",
          })),
        },
      ],
      nativePromise: async (_plugin: string, method: string, options: unknown) => {
        if (method === "pickContacts")
          return {
            contacts: [
              { name: "Ida", phones: ["+45 12 34 56 78"], emails: [] },
              { name: "Karl", phones: [], emails: ["karl@example.com"] },
            ],
          };
        if (method === "canText") return { able: true };
        if (method === "text") {
          w.__texted = options;
          return { result: "sent" };
        }
        return {};
      },
    };
  });
}

const texted = (page: Page) =>
  page.evaluate(() => (window as unknown as { __texted: unknown }).__texted);

test.describe("in the app", () => {
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, "the app is a phone"));

  test("friends picked from the contacts get the link in a message (#149)", async ({ page }) => {
    await asTheAppWithContacts(page);
    await page.goto("/groups/g-running");
    await page
      .getByRole("button", { name: /Invitér folk/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Invitér fra kontakter" }).click();
    await expect(page.getByText("Beskeden er sendt.")).toBeVisible();
    expect(await texted(page)).toEqual({
      recipients: ["+45 12 34 56 78", "karl@example.com"],
      body: "Bliv medlem af Løbeklubben på Casy, så vi kan finde en dato, der passer alle: https://casy.app/join/test-invite-token",
    });
  });

  test("a new group can be made and invited to from the contacts in one go (#149)", async ({
    page,
  }) => {
    await asTheAppWithContacts(page);
    await page.goto("/groups");
    await page.getByRole("button", { name: "Lav en gruppe" }).click();
    await page.getByLabel("Gruppenavn").fill("Fredagsfilm");
    await page.getByRole("button", { name: "Opret og invitér fra kontakter" }).click();
    await expect(page).toHaveURL(/\/groups\/g-new-\d+$/);
    await expect
      .poll(() => texted(page))
      .toEqual({
        recipients: ["+45 12 34 56 78", "karl@example.com"],
        body: "Bliv medlem af Fredagsfilm på Casy, så vi kan finde en dato, der passer alle: https://casy.app/join/test-invite-token",
      });
  });
});
