/**
 * The iPhone app, with no calendar connected, says so on My calendar and offers
 * to import the phone's (#132): a card over the month with one button, whatever
 * iOS has been told. The app's native side is faked: Capacitor reads
 * the plugin's methods from `PluginHeaders` and hands each call to
 * `nativePromise`, so the page runs as in the app, with iOS's answer chosen
 * per test (`window.__ios`).
 */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { ME } from "./world";

test.use({ world: { calendars: "none", groups: "some" } });
test.beforeEach(({ isMobile }) => test.skip(!isMobile, "the app is a phone"));

const METHODS = [
  "access",
  "requestAccess",
  "read",
  "readDetails",
  "openSettings",
  "setAppearance",
  "backgroundState",
  "setBackground",
  "clearBackground",
  "applyWrites",
];

/** The app's bridge, answering for iOS: `access` is what the person will say to its question. */
async function asTheApp(
  page: Page,
  access: "granted" | "denied",
  { alreadyAnswered = false }: { alreadyAnswered?: boolean } = {},
) {
  await page.addInitScript(
    ({ methods, answer, already }) => {
      const w = window as unknown as Record<string, unknown>;
      const asked: string[] = [];
      w.__asked = asked;
      let state = already ? answer : "prompt";
      w.Capacitor = {
        isNativePlatform: () => true,
        PluginHeaders: [
          {
            name: "PhoneCalendar",
            methods: [
              ...methods.map((name) => ({ name, rtype: "promise" })),
              // Watching the phone's calendars for changes: never fires here.
              { name: "addListener", rtype: "callback" },
              { name: "removeListener", rtype: "promise" },
            ],
          },
        ],
        nativeCallback: async () => "listener",
        nativePromise: async (_plugin: string, method: string) => {
          asked.push(method);
          if (method === "access") return { state };
          if (method === "requestAccess") {
            state = answer;
            return { state };
          }
          if (method === "read") return { calendars: [], events: [] };
          if (method === "readDetails") return { events: [] };
          if (method === "backgroundState") return { configured: true };
          return {};
        },
      };
    },
    { methods: METHODS, answer: access, already: alreadyAnswered },
  );
}

const asked = (page: Page) =>
  page.evaluate(() => (window as unknown as { __asked: string[] }).__asked);

const card = (page: Page) => page.getByRole("status");

test("with iOS not asked yet, the card offers Allow and import, and iOS asks on the press", async ({
  page,
  backend,
}) => {
  await asTheApp(page, "granted");
  await page.goto("/calendar-overview");
  await expect(
    card(page).getByRole("heading", { name: "Casy kan ikke se nogen kalender endnu" }),
  ).toBeVisible();
  // Nothing is asked by itself: the person presses.
  expect(await asked(page)).not.toContain("requestAccess");
  await card(page).getByRole("button", { name: "Tillad og importér" }).click();
  await expect.poll(() => asked(page)).toContain("requestAccess");
  await expect
    .poll(() => backend.calls.find((c) => c.name === "calendar-phone")?.body)
    .toMatchObject({ create: true });
});

test("with iOS already allowed, the same card just says Import", async ({ page, backend }) => {
  await asTheApp(page, "granted", { alreadyAnswered: true });
  await page.goto("/calendar-overview");
  await card(page).getByRole("button", { name: "Importér min kalender" }).click();
  await expect
    .poll(() => backend.calls.find((c) => c.name === "calendar-phone")?.body)
    .toMatchObject({ create: true });
});

test("a refusal leads to Settings, or to another calendar", async ({ page }) => {
  await asTheApp(page, "denied");
  await page.goto("/calendar-overview");
  await card(page).getByRole("button", { name: "Tillad og importér" }).click();
  await expect(card(page).getByRole("button", { name: "Åbn Indstillinger" })).toBeVisible();
  // Over the month, not above it: the month's own toolbar stays where it was.
  await expect(page.getByRole("button", { name: "Kalendere" })).toBeVisible();
  await card(page).getByRole("button", { name: "Åbn Indstillinger" }).click();
  await expect.poll(() => asked(page)).toContain("openSettings");

  await card(page).getByRole("link", { name: "Brug en anden kalender" }).click();
  await expect(page).toHaveURL(/\/calendar-overview\/accounts$/);
});

test("the card is there even when the app remembers a connection the server has removed", async ({
  page,
  backend,
}) => {
  // iOS was allowed long ago, and this phone's connection was removed since:
  // the routine update finds nothing to update, and the import must still work.
  await asTheApp(page, "granted", { alreadyAnswered: true });
  await page.addInitScript(
    (key) => localStorage.setItem(key, "removed-connection"),
    `casy-phone-calendar:${ME.id}`,
  );
  await page.goto("/calendar-overview");
  await card(page).getByRole("button", { name: "Importér min kalender" }).click();
  await expect
    .poll(() => backend.calls.find((c) => c.name === "calendar-phone" && c.body.create === true))
    .toBeTruthy();
});

test("signing in on the app goes straight to My calendar, not a connect page", async ({ page }) => {
  await asTheApp(page, "granted");
  await page.goto("/sign-in");
  // Signed in already (the fixture), with no calendar: the website's phone would be sent on.
  await expect(page).toHaveURL(/\/$/);
  await expect(card(page)).toBeVisible();
});

test("the website's phone has no phone to import, and keeps its notice", async ({ page }) => {
  await page.goto("/calendar-overview");
  await expect(card(page)).toHaveCount(0);
  await expect(page.getByText("Forbind en kalender")).toBeVisible();
});

test.describe("with other calendars connected, but not this phone", () => {
  test.use({ world: { calendars: "connected", groups: "some" } });

  test("the card still offers the phone's calendar, and can be put away", async ({
    page,
    backend,
  }) => {
    await asTheApp(page, "granted", { alreadyAnswered: true });
    await page.goto("/calendar-overview");
    await expect(
      card(page).getByRole("heading", { name: "Telefonens kalender er ikke med endnu" }),
    ).toBeVisible();
    await card(page).getByRole("button", { name: "Ikke nu" }).click();
    await expect(card(page)).toHaveCount(0);
    // Put away until the app is opened again, not every time the page is.
    await page.getByRole("button", { name: "Profil", exact: true }).click();
    await expect(page).toHaveURL(/\/\?profile$/);
    await page.goBack();
    await expect(page.getByRole("button", { name: "Kalendere" })).toBeVisible();
    await expect(card(page)).toHaveCount(0);
    expect(backend.calls.some((c) => c.name === "calendar-phone" && c.body.create)).toBe(false);
  });

  test("once this phone is connected, there is no card", async ({ page }) => {
    await asTheApp(page, "granted", { alreadyAnswered: true });
    // The connection the app remembers is one the server lists.
    await page.addInitScript(
      (key) => localStorage.setItem(key, "conn-apple"),
      `casy-phone-calendar:${ME.id}`,
    );
    await page.goto("/calendar-overview");
    await expect(page.getByRole("button", { name: "Kalendere" })).toBeVisible();
    await expect(card(page)).toHaveCount(0);
  });
});
