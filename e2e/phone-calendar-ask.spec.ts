/**
 * The iPhone app asks for the phone's calendar the moment My calendar opens
 * with none connected (#132). The app's native side is faked: Capacitor reads
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

test("landing on My calendar asks iOS at once, and connects the phone on yes", async ({
  page,
  backend,
}) => {
  await asTheApp(page, "granted");
  await page.goto("/calendar-overview");
  await expect.poll(() => asked(page)).toContain("requestAccess");
  await expect
    .poll(() => backend.calls.find((c) => c.name === "calendar-phone")?.body)
    .toMatchObject({ create: true });
  // Nothing was left over the month, and nothing pushed it down.
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByText("Forbind en kalender")).toHaveCount(0);
});

test("a refusal puts a card over the month, which can lead to Settings or another calendar", async ({
  page,
}) => {
  await asTheApp(page, "denied");
  await page.goto("/calendar-overview");
  const card = page.getByRole("status");
  await expect(card.getByRole("heading", { name: "Casy har brug for din kalender" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Åbn Indstillinger" })).toBeVisible();
  // Over the month, not above it: the month's own toolbar stays where it was.
  await expect(page.getByRole("button", { name: "Kalendere" })).toBeVisible();
  await card.getByRole("button", { name: "Åbn Indstillinger" }).click();
  await expect.poll(() => asked(page)).toContain("openSettings");

  await card.getByRole("link", { name: "Brug en anden kalender" }).click();
  await expect(page).toHaveURL(/\/calendar-overview\/accounts$/);
});

test("it asks once a launch: coming back to My calendar doesn't ask again", async ({ page }) => {
  await asTheApp(page, "denied");
  await page.goto("/calendar-overview");
  await expect(page.getByRole("status")).toBeVisible();
  await page.getByRole("link", { name: /Profil/ }).click();
  await page.getByRole("link", { name: /Kalender/ }).click();
  await expect(page).toHaveURL(/\/calendar-overview$/);
  expect((await asked(page)).filter((m) => m === "requestAccess")).toHaveLength(1);
});

test("signing in on the app goes straight to My calendar, not a connect page", async ({ page }) => {
  await asTheApp(page, "granted");
  await page.goto("/sign-in");
  // Signed in already (the fixture), with no calendar: the website's phone would be sent on.
  await expect(page).toHaveURL(/\/calendar-overview$/);
});

test("it connects even when the app still remembers a connection the server has removed", async ({
  page,
  backend,
}) => {
  // iOS was allowed long ago, and this phone's connection was removed since:
  // the routine update (which only updates a connection) finds nothing to
  // update, and the question to connect must not be answered by that.
  await asTheApp(page, "granted", { alreadyAnswered: true });
  await page.addInitScript(
    (key) => localStorage.setItem(key, "removed-connection"),
    `casy-phone-calendar:${ME.id}`,
  );
  await page.goto("/calendar-overview");
  await expect
    .poll(() => backend.calls.find((c) => c.name === "calendar-phone" && c.body.create === true))
    .toBeTruthy();
  await expect(page.getByRole("status")).toHaveCount(0);
});
