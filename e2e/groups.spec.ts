/** My groups: the list, one group, and an invitation. */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

test("a group opens with its members", async ({ page, isMobile }) => {
  await page.goto("/groups");
  await page
    .getByRole("link", { name: /Løbeklubben/ })
    .first()
    .click();
  // A phone opens it inside the Profil sheet (#174).
  await expect(page).toHaveURL(isMobile ? /\?profile=groups\/g-running$/ : /\/groups\/g-running$/);
  for (const name of ["Freja", "Oliver"]) {
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }
  if (isMobile) {
    // A screen of its own in the sheet, with a way back to the list.
    await page.getByRole("button", { name: "Grupper" }).click();
    await expect(page).toHaveURL(/\?profile=groups$/);
  }
});

test("a group shows what it is for, and any member can change it (#152)", async ({
  page,
  backend,
  isMobile,
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

  // A group with none offers to add one instead. Reached from inside the app,
  // not by loading the page again (#181): a second cold load took longer than
  // the last check waits when many tests ran at once. The offer is waited for
  // first, so the absence of "Ændr" below is checked on the group's own page.
  if (isMobile) await page.getByRole("button", { name: "Grupper" }).click();
  await page
    .getByRole("link", { name: /Løbeklubben/ })
    .first()
    .click();
  await expect(page.getByRole("button", { name: "Tilføj en beskrivelse" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Ændr beskrivelsen" })).toHaveCount(0);
});

test("renaming a group on a phone leaves its name where it was", async ({ page, isMobile }) => {
  test.skip(!isMobile, "only the phone's group screen is centred");
  await page.goto("/groups/g-friday");
  const name = page.getByRole("dialog").locator("p.text-xl", { hasText: "Fredagsbar" });
  const before = (await name.boundingBox())!;
  await page.getByRole("button", { name: "Omdøb gruppen" }).click();
  const box = (await page.getByRole("dialog").locator("form input").boundingBox())!;
  // The same centre, within a few pixels, instead of snapping to the left edge.
  expect(Math.abs(box.x + box.width / 2 - (before.x + before.width / 2))).toBeLessThan(12);
  expect(Math.abs(box.y + box.height / 2 - (before.y + before.height / 2))).toBeLessThan(6);
});

test("an invitation says what the group is for (#152)", async ({ page }) => {
  await page.goto("/groups");
  await expect(page.getByText("Double om torsdagen i Valby")).toBeVisible();
});

test("a phone's invitation shows who is in, and says little (#216)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "a computer keeps its card");
  await page.goto("/groups");
  await expect(page.getByText("Du er inviteret til")).toBeVisible();
  await expect(page.getByText("Sara · 5 medlemmer")).toBeVisible();
  await expect(page.getByText("Medlemmerne ser dit navn, og hvornår du er optaget.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Bloker afsenderen" })).toBeVisible();
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

test("a new group is named, then invited to, then opened (#153)", async ({
  page,
  backend,
  isMobile,
}) => {
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
  // A phone opens it inside the Profil sheet (#174).
  await expect(page).toHaveURL(isMobile ? /\?profile=groups\/g-new-\d+$/ : /\/groups\/g-new-\d+$/);
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

test.describe("friends from groups since gone (#222)", () => {
  test("can be invited again, and removed", async ({ page, backend }) => {
    backend.world.friends = [{ profileId: "p-past", name: "Tilde" }];
    await page.goto("/groups");
    await expect(page.getByText("Venner fra tidligere grupper")).toBeVisible();
    await expect(page.getByText("Tilde", { exact: true }).first()).toBeVisible();

    // Offered when inviting, though no group of yours holds them any more.
    await page.goto("/groups/g-running");
    await page
      .getByRole("button", { name: /Invitér folk/ })
      .first()
      .click();
    const sheet = page.getByRole("dialog", { name: "Invitér til Løbeklubben" });
    await sheet.getByRole("checkbox", { name: /^Tilde/ }).check();
    await expect(sheet.getByText("Fra en tidligere gruppe")).toBeVisible();
    await sheet.getByRole("button", { name: "Send invitation" }).click();
    await expect
      .poll(() => backend.calls.find((c) => c.body.action === "invite-members")?.body)
      .toMatchObject({ profileIds: ["p-past"] });
    await page.goto("/groups");

    await page.getByRole("button", { name: "Fjern Tilde" }).click();
    await expect(page.getByText(/^Fjern Tilde\?/)).toBeVisible();
    await page.getByRole("button", { name: "Fjern", exact: true }).click();
    await expect(page.getByText("Venner fra tidligere grupper")).toHaveCount(0);
    expect(backend.calls.find((c) => c.body.action === "remove-friend")?.body).toMatchObject({
      profileId: "p-past",
    });
  });

  test("someone still in a group of yours isn't listed apart", async ({ page, backend }) => {
    const member = backend.world.groups[0].members.find((m) => !m.isYou)!;
    backend.world.friends = [{ profileId: member.profileId, name: member.name }];
    await page.goto("/groups");
    await expect(
      page
        .getByRole("button", { name: /Fredagsbar/ })
        .or(page.getByRole("link", { name: /Fredagsbar/ }))
        .first(),
    ).toBeVisible();
    await expect(page.getByText("Venner fra tidligere grupper")).toHaveCount(0);
  });
});

test.describe("swiping a group in the list (#223)", () => {
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, "phones only"));

  async function swipe(page: import("@playwright/test").Page, name: RegExp) {
    const row = page.getByRole("link", { name });
    await expect(row).toBeVisible();
    const box = (await row.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width - 20, y);
    await page.mouse.down();
    for (const dx of [20, 60, 120, 180]) await page.mouse.move(box.x + box.width - 20 - dx, y);
    await page.mouse.up();
  }

  test("a group you made asks before it goes for everyone", async ({ page, backend }) => {
    await page.goto("/groups");
    await swipe(page, /^Fredagsbar/);
    await page.getByRole("button", { name: "Slet", exact: true }).click();
    expect(backend.calls.some((c) => c.body.action === "delete")).toBe(false);
    await expect(page.getByText(/^Slet "Fredagsbar" for alle\?/)).toBeVisible();
    // Under its own row.
    const asked = page.getByRole("listitem").filter({ hasText: /^.*Slet "Fredagsbar" for alle/ });
    await asked.getByRole("button", { name: "Slet", exact: true }).last().click();
    await expect
      .poll(() => backend.calls.find((c) => c.body.action === "delete")?.body)
      .toMatchObject({
        groupId: "g-friday",
      });
    await expect(page.getByRole("link", { name: /^Fredagsbar/ })).toHaveCount(0);
  });

  test("someone else's group is left at the press, nothing happening before it", async ({
    page,
    backend,
  }) => {
    await page.goto("/groups");
    await swipe(page, /^Løbeklubben/);
    expect(backend.calls.some((c) => c.body.action === "leave")).toBe(false);
    await page.getByRole("button", { name: "Forlad", exact: true }).click();
    await expect
      .poll(() => backend.calls.find((c) => c.body.action === "leave")?.body)
      .toMatchObject({
        groupId: "g-running",
      });
  });

  test("a tap on a row swiped open closes it, rather than opening the group", async ({ page }) => {
    await page.goto("/groups");
    await swipe(page, /^Fredagsbar/);
    const row = page.getByRole("link", { name: /^Fredagsbar/ });
    const box = (await row.boundingBox())!;
    await page.waitForTimeout(350);
    await page.mouse.click(box.x + 150, box.y + box.height / 2);
    await page.waitForTimeout(200);
    expect(new URL(page.url()).search).not.toContain("groups/g-friday");
    expect(new URL(page.url()).pathname).not.toContain("g-friday");
  });

  test("a tap on a row left alone still opens the group", async ({ page }) => {
    await page.goto("/groups");
    await page.getByRole("link", { name: /^Fredagsbar/ }).click();
    await expect(page).toHaveURL(/g-friday/);
  });
});
