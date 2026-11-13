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

test("after sending dates, Casy says why with one way on: to iOS's question (#147)", async ({
  page,
}) => {
  await asTheApp(page, "prompt");
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Planlæg" })).toBeVisible();

  const sheet = await momentShows(page, "sent", "Få besked, når de andre har svaret");
  await expect(sheet.getByRole("button", { name: "Fortsæt" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Ikke nu" })).toHaveCount(0);
});

test("a yes to Casy's question hands over to iOS, and then registers the phone", async ({
  page,
}) => {
  await asTheApp(page, "prompt");
  await page.goto("/");
  const sheet = await momentShows(page, "joined", "Få besked, når nogen foreslår datoer");
  const asked = () => page.evaluate(() => (window as unknown as { __asked: string[] }).__asked);
  // Casy's sheet alone asks iOS nothing.
  expect(await asked()).not.toContain("requestPermissions");
  await sheet.getByRole("button", { name: "Fortsæt" }).click();
  await expect.poll(asked).toContain("requestPermissions");
  // iOS said yes (the fake); registering then waits for a token the fake never gives.
  await expect.poll(asked).toContain("register");
});

test("never asked again once iOS has said no", async ({ page }) => {
  await asTheApp(page, "denied");
  await page.goto("/");
  await moment(page, "sent");
  await page.waitForTimeout(1200);
  await expect(page.getByRole("dialog", { name: /^Få besked/ })).toHaveCount(0);
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
    "Du mangler at svare",
  ];
  for (const kind of kinds) await expect(group.getByRole("switch", { name: kind })).toBeChecked();

  await group.getByRole("switch", { name: "Du mangler at svare" }).click();
  await expect(group.getByRole("switch", { name: "Du mangler at svare" })).not.toBeChecked();
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
  await expect(
    page.getByText("Slå dem til under Find en dag i iPhones Indstillinger."),
  ).toBeVisible();
});

test("the website has no notifications group", async ({ page }) => {
  await page.goto("/profile/settings");
  await expect(
    page.getByRole("heading", { name: "Sprog" }).or(page.getByText("Sprog").first()),
  ).toBeVisible();
  await expect(page.getByText("Notifikationer")).toHaveCount(0);
});

test.describe("after saying yes to an invitation (#230)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the sheet shrinks once, and what comes after waits, one at a time", async ({ page }) => {
    await asTheApp(page, "prompt");
    await page.goto("/");
    await page.getByRole("button", { name: "Profil" }).click();
    await page
      .getByRole("link", { name: /Grupper/ })
      .first()
      .click();
    await page.getByRole("link", { name: /Badminton/ }).click();
    const yes = page.getByRole("button", { name: "Bliv medlem" });
    await expect(yes).toBeVisible();
    // Long enough for the phone's calendar question to be due.
    await page.waitForTimeout(3100);

    // How many sheets there are on every frame from here.
    await page.evaluate(() => {
      const frames: { at: number; sheets: number }[] = [];
      (window as unknown as { __frames: typeof frames }).__frames = frames;
      const tick = () => {
        frames.push({
          at: performance.now(),
          sheets: document.querySelectorAll('[role="dialog"]').length,
        });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await yes.click();
    await expect(page.getByRole("dialog", { name: /^Få besked/ })).toBeVisible({ timeout: 5000 });
    // Past when the phone's calendar question would have come: still only this one.
    await page.waitForTimeout(3500);
    await expect(page.getByRole("dialog")).toHaveCount(1);

    const frames = await page.evaluate(
      () => (window as unknown as { __frames: { at: number; sheets: number }[] }).__frames,
    );
    expect(Math.max(...frames.map((f) => f.sheets))).toBe(1);
    const gone = frames.find((f) => f.sheets === 0);
    const next = frames.find((f) => gone && f.at > gone.at && f.sheets > 0);
    // A clear beat with the month bare, not a second animation straight after the first.
    expect(next!.at - gone!.at).toBeGreaterThan(500);
  });
});
