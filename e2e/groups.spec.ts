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

test("a group shows what it is for, and any member can change it (#152)", async ({
  page,
  backend,
}) => {
  await page.goto("/groups/g-friday");
  await expect(page.getByText("En øl efter arbejde, når det passer de fleste")).toBeVisible();

  await page.getByRole("button", { name: "Ændr beskrivelsen" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Beskrivelse" });
  await sheet.getByLabel("Hvad er gruppen til?").fill("Fredagsøl i Nørrebro");
  await sheet.getByRole("button", { name: "Gem" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Fredagsøl i Nørrebro")).toBeVisible();
  expect(backend.calls.find((c) => c.body.action === "describe")?.body).toMatchObject({
    groupId: "g-friday",
    description: "Fredagsøl i Nørrebro",
  });

  // A group with none offers to add one instead.
  await page.goto("/groups/g-running");
  await expect(page.getByRole("button", { name: "Ændr beskrivelsen" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tilføj en beskrivelse" }).first()).toBeVisible();
});

test("renaming a group on a phone leaves its name where it was", async ({ page, isMobile }) => {
  test.skip(!isMobile, "only the phone's group screen is centred");
  await page.goto("/groups/g-friday");
  const name = page.locator("main p.text-xl", { hasText: "Fredagsbar" });
  const before = (await name.boundingBox())!;
  await page.getByRole("button", { name: "Omdøb gruppen" }).click();
  const box = (await page.locator("main form input").boundingBox())!;
  // The same centre, within a few pixels, instead of snapping to the left edge.
  expect(Math.abs(box.x + box.width / 2 - (before.x + before.width / 2))).toBeLessThan(12);
  expect(Math.abs(box.y + box.height / 2 - (before.y + before.height / 2))).toBeLessThan(6);
});

test("an invitation says what the group is for (#152)", async ({ page }) => {
  await page.goto("/groups");
  await expect(page.getByText("Double om torsdagen i Valby")).toBeVisible();
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

test("a new group is named, then invited to, then opened (#153)", async ({ page, backend }) => {
  await page.goto("/groups");
  await page.getByRole("button", { name: "Lav en gruppe" }).click();
  await page.getByLabel("Gruppenavn").fill("Fredagsfilm");
  await page.getByLabel(/Hvad er gruppen til/).fill("Film og pizza");
  await page.getByRole("button", { name: "Næste" }).click();
  // The same sheet goes on to inviting to the group just made.
  const sheet = page.getByRole("dialog", { name: "Invitér til Fredagsfilm" });
  await expect(sheet).toBeVisible();
  expect(backend.calls.find((c) => c.body.action === "create")?.body).toMatchObject({
    name: "Fredagsfilm",
    description: "Film og pizza",
  });
  expect(backend.calls.find((c) => c.body.action === "create")?.body).not.toHaveProperty(
    "profileIds",
  );
  // Nobody picked: no button to send, only Færdig, which opens the group.
  await expect(sheet.getByRole("button", { name: /^Send/ })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Færdig" }).click();
  await expect(page).toHaveURL(/\/groups\/g-new-\d+$/);
});

test("people picked in the invite get an invitation, and show as invited", async ({
  page,
  backend,
}) => {
  await page.goto("/groups/g-running");
  await page
    .getByRole("button", { name: /Invitér folk/ })
    .first()
    .click();
  const sheet = page.getByRole("dialog", { name: "Invitér til Løbeklubben" });
  // A tap on the row picks the person: a tick at its end, a real checkbox over it.
  await sheet.getByRole("checkbox", { name: /^Emil/ }).check();
  await sheet.getByRole("button", { name: "Send invitation" }).click();
  await expect(sheet.getByText("Invitationerne er sendt.")).toBeVisible();
  expect(backend.calls.find((c) => c.body.action === "invite-members")).toBeTruthy();
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

  test("a new group's invite step invites from the contacts (#149, #153)", async ({ page }) => {
    await asTheAppWithContacts(page);
    await page.goto("/groups");
    await page.getByRole("button", { name: "Lav en gruppe" }).click();
    await page.getByLabel("Gruppenavn").fill("Fredagsfilm");
    await page.getByRole("button", { name: "Næste" }).click();
    await page.getByRole("button", { name: "Invitér fra kontakter" }).click();
    await expect
      .poll(() => texted(page))
      .toEqual({
        recipients: ["+45 12 34 56 78", "karl@example.com"],
        body: "Bliv medlem af Fredagsfilm på Casy, så vi kan finde en dato, der passer alle: https://casy.app/join/test-invite-token",
      });
  });
});
