/** Notifications in the iPhone app (#139): the question, and the switches in Settings. */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "the app is a phone"));

/** The app's bridge, answering for iOS: `permission` is what iOS says about notifications now. */
async function asTheApp(page: Page, permission: "prompt" | "granted" | "denied") {
  await page.addInitScript((initial) => {
    let state = initial;
    const asked: string[] = [];
    (window as unknown as Record<string, unknown>).__asked = asked;
    (window as unknown as Record<string, unknown>).Capacitor = {
      isNativePlatform: () => true,
      PluginHeaders: [
        {
          name: "PushNotifications",
          methods: [
            { name: "checkPermissions", rtype: "promise" },
            { name: "requestPermissions", rtype: "promise" },
            { name: "register", rtype: "promise" },
            { name: "addListener", rtype: "callback" },
            { name: "removeListener", rtype: "promise" },
          ],
        },
      ],
      nativeCallback: async () => "listener",
      nativePromise: async (_plugin: string, method: string) => {
        asked.push(method);
        if (method === "checkPermissions") return { receive: state };
        if (method === "requestPermissions") {
          state = "granted";
          return { receive: state };
        }
        return {};
      },
    };
  }, permission);
}

/** What the page says Casy has just seen the person do. */
const moment = (page: Page, reason: "sent" | "answered" | "joined") =>
  page.evaluate(
    (detail) => window.dispatchEvent(new CustomEvent("casy:push-ask", { detail })),
    reason,
  );

/**
 * The moment, repeated until the part of the page that listens (loaded after
 * the first screen, in the app only) has attached and shows the sheet.
 */
async function momentShows(page: Page, reason: "sent" | "answered" | "joined", title: string) {
  const sheet = page.getByRole("dialog", { name: title });
  await expect(async () => {
    await moment(page, reason);
    await expect(sheet).toBeVisible({ timeout: 1500 });
  }).toPass();
  return sheet;
}

test("after sending dates, Casy asks before iOS does, and Not now waits a week", async ({
  page,
}) => {
  await asTheApp(page, "prompt");
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: "Mine aftaler" })).toBeVisible();

  const sheet = await momentShows(page, "sent", "Få besked, når de andre har svaret");
  await expect(sheet.getByRole("button", { name: "Slå notifikationer til" })).toBeVisible();
  await sheet.getByRole("button", { name: "Ikke nu" }).click();
  await expect(sheet).toHaveCount(0);

  // The next moment is within the week: nothing shows.
  await moment(page, "answered");
  await page.waitForTimeout(1200);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a yes to Casy's question hands over to iOS, and then registers the phone", async ({
  page,
}) => {
  await asTheApp(page, "prompt");
  await page.goto("/events");
  const sheet = await momentShows(page, "joined", "Få besked, når nogen foreslår datoer");
  const asked = () => page.evaluate(() => (window as unknown as { __asked: string[] }).__asked);
  // Casy's sheet alone asks iOS nothing.
  expect(await asked()).not.toContain("requestPermissions");
  await sheet.getByRole("button", { name: "Slå notifikationer til" }).click();
  await expect.poll(asked).toContain("requestPermissions");
  // iOS said yes (the fake); registering then waits for a token the fake never gives.
  await expect.poll(asked).toContain("register");
});

test("never asked again once iOS has said no", async ({ page }) => {
  await asTheApp(page, "denied");
  await page.goto("/events");
  await moment(page, "sent");
  await page.waitForTimeout(1200);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Settings has a switch for each kind once notifications are on, and keeps a switch off", async ({
  page,
  backend,
}) => {
  await asTheApp(page, "granted");
  await page.goto("/profile/settings");
  const group = page.getByRole("list").filter({ has: page.getByText("Datoen er fundet") });
  const kinds = [
    "Nogen foreslår datoer til dig",
    "Datoen er fundet",
    "Datoen ændres, eller aftalen aflyses",
    "Du bliver inviteret til en gruppe",
    "Svarfristen nærmer sig",
  ];
  for (const kind of kinds) await expect(group.getByRole("switch", { name: kind })).toBeChecked();

  await group.getByRole("switch", { name: "Svarfristen nærmer sig" }).click();
  await expect(group.getByRole("switch", { name: "Svarfristen nærmer sig" })).not.toBeChecked();
  expect(backend.world.pushOff).toEqual(["deadline_near"]);
  await expect(group.getByRole("switch", { name: "Datoen er fundet" })).toBeChecked();
});

test("Settings offers to turn notifications on, or says where after a no", async ({ page }) => {
  await asTheApp(page, "prompt");
  await page.goto("/profile/settings");
  await expect(page.getByRole("button", { name: /Slå notifikationer til/ })).toBeVisible();
});

test("after a no in iOS, Settings says where to undo it", async ({ page }) => {
  await asTheApp(page, "denied");
  await page.goto("/profile/settings");
  await expect(page.getByText("Slå dem til under Casy i iPhones Indstillinger.")).toBeVisible();
});

test("the website has no notifications group", async ({ page }) => {
  await page.goto("/profile/settings");
  await expect(
    page.getByRole("heading", { name: "Sprog" }).or(page.getByText("Sprog").first()),
  ).toBeVisible();
  await expect(page.getByText("Notifikationer")).toHaveCount(0);
});
