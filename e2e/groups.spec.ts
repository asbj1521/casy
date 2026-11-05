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

  // A phone changes it with the name and the picture, in one sheet (#227).
  await page
    .getByRole("button", { name: isMobile ? "Rediger gruppe" : "Ændr beskrivelsen" })
    .first()
    .click();
  const sheet = page.getByRole("dialog", { name: isMobile ? "Rediger gruppe" : "Beskrivelse" });
  await sheet.getByLabel(/Hvad er gruppen til\?/).fill("Fredagsøl i Nørrebro");
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
  if (isMobile) return;
  await page
    .getByRole("link", { name: /Løbeklubben/ })
    .first()
    .click();
  await expect(page.getByRole("button", { name: "Tilføj en beskrivelse" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Ændr beskrivelsen" })).toHaveCount(0);
});

test.describe("a group on a phone (#227)", () => {
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, "a computer keeps its pane"));

  test("its name is changed in one sheet, and only what changed is saved", async ({
    page,
    backend,
  }) => {
    await page.goto("/groups/g-friday");
    await page.getByRole("button", { name: "Rediger gruppe" }).click();
    const sheet = page.getByRole("dialog", { name: "Rediger gruppe" });
    await sheet.getByLabel("Gruppenavn").fill("Fredagsøl");
    await sheet.getByRole("button", { name: "Gem" }).click();
    await expect(sheet).toBeHidden();
    expect(backend.calls.find((c) => c.body.action === "rename")?.body).toMatchObject({
      name: "Fredagsøl",
    });
    expect(backend.calls.some((c) => c.body.action === "describe")).toBe(false);
  });

  test("what members see is behind a ?, and leaving asks in a sheet", async ({ page, backend }) => {
    await page.goto("/groups/g-friday");
    await expect(page.getByText(/^Alle i en gruppe kan se/)).toHaveCount(0);
    await page.getByRole("button", { name: "Hvad kan medlemmerne se?" }).click();
    await expect(page.getByText(/^Alle i en gruppe kan se/)).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Forlad gruppe" }).click();
    const ask = page.getByRole("dialog", { name: "Er du sikker?" });
    await ask.getByRole("button", { name: "Annuller" }).click();
    await expect(ask).toHaveCount(0);
    expect(backend.calls.some((c) => c.body.action === "leave")).toBe(false);

    await page.getByRole("button", { name: "Forlad gruppe" }).click();
    await page
      .getByRole("dialog", { name: "Er du sikker?" })
      .getByRole("button", { name: "Forlad gruppe" })
      .click();
    await expect.poll(() => backend.calls.some((c) => c.body.action === "leave")).toBe(true);
  });

  test("inviting shows email and link first, and folds a long list of people", async ({
    page,
    backend,
  }) => {
    backend.world.friends = ["Ane", "Bo", "Carl", "Dan", "Eva", "Finn"].map((name) => ({
      profileId: `p-${name}`,
      name,
    }));
    await page.goto("/groups/g-running");
    await page.getByRole("button", { name: /Invitér folk/ }).click();
    const sheet = page.getByRole("dialog", { name: "Invitér til Løbeklubben" });
    const words = (await sheet.textContent()) ?? "";
    expect(words.indexOf("Med e-mail")).toBeLessThan(words.indexOf("Folk fra dine grupper"));

    await expect(sheet.getByRole("checkbox")).toHaveCount(4);
    await sheet.getByRole("button", { name: /^Vis alle/ }).click();
    await sheet.getByRole("checkbox", { name: /^Finn/ }).check();
    await sheet.getByRole("button", { name: "Vis færre" }).click();
    // Someone picked stays in view when the list folds.
    await expect(sheet.getByRole("checkbox", { name: /^Finn/ })).toBeChecked();
    await expect(sheet.getByRole("checkbox")).toHaveCount(5);
  });

  test("after making a group, sending finishes it, with no second Færdig", async ({ page }) => {
    await page.goto("/groups");
    await page.getByRole("button", { name: "Lav en gruppe" }).click();
    await page.getByLabel("Gruppenavn").fill("Fredagsfilm");
    await page.getByRole("button", { name: "Næste" }).click();
    const sheet = page.getByRole("dialog", { name: "Invitér til Fredagsfilm" });
    await sheet.getByRole("checkbox").first().check();
    await sheet.getByRole("button", { name: "Send invitation" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("friends have their own screen, not a place among the groups", async ({ page, backend }) => {
    backend.world.friends = [{ profileId: "p-past", name: "Tilde" }];
    await page.goto("/?profile");
    await page.getByRole("link", { name: "Venner", exact: true }).click();
    await expect(page).toHaveURL(/\?profile=friends$/);
    // People still in a group are here too, but only those from gone ones can go.
    await expect(page.getByText("Jonas", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fjern Jonas" })).toHaveCount(0);
    await page.getByRole("button", { name: "Fjern Tilde" }).click();
    await page
      .getByRole("dialog", { name: "Er du sikker?" })
      .getByRole("button", { name: "Fjern" })
      .click();
    await expect(page.getByText("Tilde", { exact: true })).toHaveCount(0);

    await page.goto("/groups");
    await expect(page.getByText("Venner fra tidligere grupper")).toHaveCount(0);
  });
});

test("an invitation says what the group is for (#152)", async ({ page, isMobile }) => {
  await page.goto(isMobile ? "/invited/g-badminton" : "/groups");
  await expect(page.getByText("Double om torsdagen i Valby")).toBeVisible();
});

test.describe("a phone's invitation (#224)", () => {
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, "a computer keeps its card"));

  test("is a row under Grupper that slides in inside the sheet, and says little", async ({
    page,
  }) => {
    await page.goto("/groups");
    await page.getByRole("link", { name: /Badminton/ }).click();
    await expect(page).toHaveURL(/\?profile=invited\/g-badminton$/);
    await expect(page.getByRole("dialog", { name: "Invitationer" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sara har inviteret dig til" })).toBeVisible();
    await expect(page.getByText(/^Medlemmer kan se/)).toHaveCount(0);

    await page.getByRole("button", { name: "Om invitationen" }).click();
    const about = page.getByRole("dialog", { name: "Om invitationen" });
    await expect(about.getByText(/^Medlemmer kan se/)).toBeVisible();
    await expect(about.getByRole("button", { name: "Bloker afsenderen" })).toBeVisible();
  });

  test("yes joins and goes home", async ({ page, backend }) => {
    await page.goto("/invited/g-badminton");
    await page.getByRole("button", { name: "Bliv medlem" }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(backend.calls.some((c) => c.body.action === "accept-invitation")).toBe(true);
  });

  test("blocking the sender goes back to Grupper", async ({ page, backend }) => {
    await page.goto("/invited/g-badminton");
    await page.getByRole("button", { name: "Om invitationen" }).click();
    const about = page.getByRole("dialog", { name: "Om invitationen" });
    await about.getByRole("button", { name: "Bloker afsenderen" }).click();
    await page.getByRole("button", { name: "Bloker", exact: true }).click();
    await expect(page).toHaveURL(/profile=groups/);
    expect(backend.world.blocked).toHaveLength(1);
  });

  test("its way back is Grupper", async ({ page }) => {
    await page.goto("/invited/g-badminton");
    await page.getByRole("button", { name: "Grupper" }).click();
    await expect(page).toHaveURL(/\?profile=groups$/);
  });

  test("one that is gone says so", async ({ page }) => {
    await page.goto("/invited/g-nothing");
    await expect(
      page.getByRole("heading", { name: "Invitationen findes ikke længere" }),
    ).toBeVisible();
  });
});

test("declining an invitation removes it", async ({ page, backend, isMobile }) => {
  await page.goto("/groups");
  await expect(page.getByText("Badminton")).toBeVisible();
  if (isMobile) await page.getByRole("link", { name: /Badminton/ }).click();
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
  // Nobody picked: no button to send, only Færdig, which opens the group on a
  // computer and ends it on a phone, with no second Færdig to press (#227).
  await expect(sheet.getByRole("button", { name: /^Send/ })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Færdig" }).click();
  await expect(page).toHaveURL(isMobile ? /\/$/ : /\/groups\/g-new-\d+$/);
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
  test("can be invited again, and removed", async ({ page, backend, isMobile }) => {
    backend.world.friends = [{ profileId: "p-past", name: "Tilde" }];
    await page.goto(isMobile ? "/?profile=friends" : "/groups");
    if (!isMobile) await expect(page.getByText("Venner fra tidligere grupper")).toBeVisible();
    await expect(page.getByText("Tilde", { exact: true }).first()).toBeVisible();

    // Offered when inviting, though no group of yours holds them any more.
    await page.goto("/groups/g-running");
    await page
      .getByRole("button", { name: /Invitér folk/ })
      .first()
      .click();
    const sheet = page.getByRole("dialog", { name: "Invitér til Løbeklubben" });
    await sheet.getByRole("checkbox", { name: /^Tilde/ }).check();
    await expect(sheet.getByText("Din ven")).toBeVisible();
    await sheet.getByRole("button", { name: "Send invitation" }).click();
    await expect
      .poll(() => backend.calls.find((c) => c.body.action === "invite-members")?.body)
      .toMatchObject({ profileIds: ["p-past"] });
    await page.goto(isMobile ? "/?profile=friends" : "/groups");

    await page.getByRole("button", { name: "Fjern Tilde" }).click();
    await expect(page.getByText(/^Fjern Tilde\?/)).toBeVisible();
    await page.getByRole("button", { name: "Fjern", exact: true }).click();
    await expect(page.getByText("Tilde", { exact: true })).toHaveCount(0);
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
    await page
      .getByRole("dialog", { name: "Er du sikker?" })
      .getByRole("button", { name: "Slet", exact: true })
      .click();
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

test.describe("adding a friend by link (#226)", () => {
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, "the app is a phone"));

  test("the Venner screen makes a link to send", async ({ page, backend }) => {
    await page.goto("/?profile=friends");
    await page.getByRole("button", { name: "Tilføj en ven" }).click();
    const sheet = page.getByRole("dialog", { name: "Tilføj en ven" });
    await sheet.getByRole("button", { name: "Lav et link" }).click();
    await expect(sheet.getByText("casy.app/friend/test-friend-token")).toBeVisible();
    expect(backend.calls.some((c) => c.body.action === "friend-link")).toBe(true);
  });

  test("a tap on the link's page is the yes, and leads to Venner", async ({ page }) => {
    await page.goto("/friend/a-token");
    await expect(page.getByRole("heading", { name: "Sara vil være venner" })).toBeVisible();
    await page.getByRole("button", { name: "Bliv venner" }).click();
    await expect(page).toHaveURL(/\?profile=friends$/);
    await expect(page.getByText("Sara Ny", { exact: true }).first()).toBeVisible();
  });

  test("your own link says so", async ({ page }) => {
    await page.goto("/friend/own-token");
    await page.getByRole("button", { name: "Bliv venner" }).click();
    await expect(page.getByText("This is your own friend link.")).toBeVisible();
  });

  test("back from signing up, the yes already given makes you friends", async ({
    page,
    backend,
  }) => {
    await page.goto("/friend/a-token?add=1");
    await expect
      .poll(() => backend.calls.filter((c) => c.body.action === "add-friend").length)
      .toBe(1);
    await expect(page).toHaveURL(/\?profile=friends$/);
  });

  test.describe("signed out", () => {
    test.use({ signedIn: false });

    test("says who asks, and goes through sign-up", async ({ page }) => {
      await page.goto("/friend/a-token");
      await expect(page.getByRole("heading", { name: "Sara vil være venner" })).toBeVisible();
      await page.getByRole("link", { name: "Bliv venner" }).click();
      await expect(page).toHaveURL(/\/sign-in\?signup=1&next=%2Ffriend%2Fa-token%3Fadd%3D1/);
    });

    test("an expired link says so", async ({ page }) => {
      await page.goto("/friend/expired-token");
      await expect(page.getByRole("heading", { name: "Invitationen virker ikke" })).toBeVisible();
    });
  });
});
