/** How far My calendar scrolls on a phone (#231): three years in the app, the year searched otherwise. */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { ME } from "./world";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "the months a phone scrolls"));

/** What the title says of the month `ahead` months from now, as My calendar names it. */
const titleOf = (page: Page, ahead: number) =>
  page.evaluate((months) => {
    const now = new Date();
    const at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, 15));
    const name = at.toLocaleString("da-DK", { month: "long", timeZone: "Europe/Copenhagen" });
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${at.getUTCFullYear()}`;
  }, ahead);

/** Scrolled to the end, again and again as more months arrive, until the title says `title`. */
async function scrollUntil(page: Page, title: string) {
  const months = page.locator("[data-floating-header]");
  await expect(async () => {
    await months.evaluate((el) => (el.scrollTop = el.scrollHeight));
    await expect(page.locator("[data-month-title]")).toHaveText(title, { timeout: 400 });
  }).toPass({ timeout: 20_000 });
}

/** The app's bridge, keeping what My calendar asks the phone for. */
async function asTheApp(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const asked: { method: string; from?: number; to?: number }[] = [];
    w.__asked = asked;
    w.Capacitor = {
      isNativePlatform: () => true,
      PluginHeaders: [
        {
          name: "PhoneCalendar",
          methods: [
            ...["access", "read", "readDetails", "calendarInfo", "backgroundState"].map((name) => ({
              name,
              rtype: "promise",
            })),
            { name: "addListener", rtype: "callback" },
            { name: "removeListener", rtype: "promise" },
          ],
        },
      ],
      nativeCallback: async () => "listener",
      nativePromise: async (
        _plugin: string,
        method: string,
        options: { from?: number; to?: number },
      ) => {
        asked.push({ method, from: options?.from, to: options?.to });
        if (method === "access") return { state: "granted" };
        if (method === "read") return { calendars: [], events: [] };
        if (method === "readDetails") return { events: [] };
        if (method === "calendarInfo") return { calendars: [] };
        if (method === "backgroundState") return { configured: true };
        return {};
      },
    };
  });
}

const asked = (page: Page, method: string) =>
  page.evaluate(
    (name) =>
      (window as unknown as { __asked: { method: string; to: number }[] }).__asked.filter(
        (a) => a.method === name,
      ),
    method,
  );

const DAY_MS = 86_400_000;

test("in the app the months go on for three years, and the title names the last", async ({
  page,
}) => {
  await asTheApp(page);
  await page.goto("/");
  await scrollUntil(page, await titleOf(page, 35));
  // And no further.
  await page.locator("[data-floating-header]").evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(page.locator("[data-month-title]")).toHaveText(await titleOf(page, 35));
});

test("the phone is read further only once someone scrolls there, and nothing further is sent", async ({
  page,
}) => {
  await asTheApp(page);
  await page.addInitScript(
    (key) => localStorage.setItem(key, "conn-apple"),
    `casy-phone-calendar:${ME.id}`,
  );
  await page.goto("/");
  await expect.poll(async () => (await asked(page, "readDetails")).length).toBeGreaterThan(0);
  const reach = async () => Math.max(...(await asked(page, "readDetails")).map((a) => a.to));
  const now = await page.evaluate(() => Date.now());
  expect(await reach()).toBeLessThan(now + 400 * DAY_MS);

  await scrollUntil(page, await titleOf(page, 23));
  await expect.poll(reach).toBeGreaterThan(now + 2.5 * 365 * DAY_MS);
  // What goes to the server is built from `read`, and that stays on its year.
  for (const read of await asked(page, "read")) {
    expect(read.to).toBeLessThan(now + 400 * DAY_MS);
  }
});

test("on the website the months stop at the year searched", async ({ page }) => {
  await page.goto("/");
  const last = await titleOf(page, 11);
  await scrollUntil(page, last);
  await page.locator("[data-floating-header]").evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(page.locator("[data-month-title]")).toHaveText(last);
});
