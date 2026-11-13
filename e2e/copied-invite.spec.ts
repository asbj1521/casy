/**
 * The invite that came through the App Store (#277): the invite page on an
 * iPhone copies its link on the way, and once signed in to the app, in no
 * group yet, a copied link opens the paste sheet by itself. One tap and the
 * group is joined. The app's native side is faked as in
 * phone-calendar-ask.spec.ts: `copiedLink` says whether a link is copied.
 */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "the app is a phone"));

async function asTheApp(page: Page, { link, change = 7 }: { link: boolean; change?: number }) {
  await page.addInitScript(
    ({ link, change }) => {
      const w = window as unknown as Record<string, unknown>;
      w.Capacitor = {
        isNativePlatform: () => true,
        PluginHeaders: [{ name: "Invite", methods: [{ name: "copiedLink", rtype: "promise" }] }],
        nativePromise: async (_plugin: string, method: string) =>
          method === "copiedLink" ? { link, change } : {},
      };
      // What iOS hands over once the person allows the paste.
      Object.defineProperty(navigator, "clipboard", {
        value: { readText: () => Promise.resolve("https://casy.app/join/a-token") },
      });
    },
    { link, change },
  );
}

test.describe("in no group yet", () => {
  test.use({ world: { calendars: "connected", groups: "none" } });

  test("a copied link opens the paste sheet, and one tap joins the group", async ({
    page,
    backend,
  }) => {
    await asTheApp(page, { link: true });
    await page.goto("/");
    const sheet = page.getByRole("dialog", { name: "Fik du en invitation?" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Indsæt link" }).click();
    await expect.poll(() => backend.calls.find((c) => c.body.action === "join")).toBeTruthy();
  });

  test("asked once per copy", async ({ page }) => {
    await asTheApp(page, { link: true });
    await page.goto("/");
    const sheet = page.getByRole("dialog", { name: "Fik du en invitation?" });
    await expect(sheet).toBeVisible();
    await page.getByRole("button", { name: "Annuller" }).click();
    await expect(sheet).toHaveCount(0);
    await page.reload();
    // Then, and only then, the calendar step.
    await expect(page.getByRole("dialog", { name: "Forbind din kalender" })).toBeVisible();
    await expect(sheet).toHaveCount(0);
  });

  test("nothing copied, nothing asked", async ({ page }) => {
    await asTheApp(page, { link: false });
    await page.goto("/");
    // Then, and only then, the calendar step.
    await expect(page.getByRole("dialog", { name: "Forbind din kalender" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Fik du en invitation?" })).toHaveCount(0);
  });
});

test("someone already in a group is not asked", async ({ page }) => {
  await asTheApp(page, { link: true });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Planlæg" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Fik du en invitation?" })).toHaveCount(0);
});
