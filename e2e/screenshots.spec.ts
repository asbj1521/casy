/**
 * The key pages compared with their reference images (e2e/__screenshots__),
 * at a computer's width and a phone's, in Danish. A change that moves pixels
 * on purpose comes with new reference images in the same commit; one that
 * wasn't meant to (the computer view after phone work, say) fails here.
 *
 * Only on Linux, where the reference images are made: fonts render
 * differently on a Mac. CI runs these in Playwright's Docker image, and the
 * "Update screenshots" workflow makes new reference images (e2e/README.md).
 */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import type { WorldOptions } from "./world";

test.skip(
  process.platform !== "linux" && !process.env.SCREENSHOTS_ANY_PLATFORM,
  "reference images are made on Linux (e2e/README.md)",
);

/**
 * The whole page in one image. A phone's tab bar is pinned to the bottom of
 * the screen, so the screen is made as tall as the page first; otherwise it
 * would be drawn halfway down.
 */
async function expectPage(page: Page, name: string, isMobile: boolean) {
  await page.waitForLoadState("networkidle");
  // Placeholders (ui/Bone.tsx) gone: the data has arrived and been drawn.
  await expect(page.locator(".animate-pulse")).toHaveCount(0);
  if (isMobile) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 390, height });
    await expect(page).toHaveScreenshot(`${name}.png`);
  } else {
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  }
}

const PAGES: { name: string; path: string; world?: WorldOptions; signedIn?: boolean }[] = [
  { name: "landing", path: "/", signedIn: false },
  { name: "scheduler", path: "/" },
  { name: "scheduler-examples", path: "/", world: { calendars: "connected", groups: "none" } },
  { name: "groups", path: "/groups" },
  { name: "group", path: "/groups/g-friday" },
  { name: "events", path: "/events" },
  { name: "event-vote", path: "/events/ev-boardgames" },
  { name: "calendar", path: "/calendar-overview" },
  { name: "calendars-connected", path: "/calendar-overview/accounts" },
  {
    name: "calendars-none",
    path: "/calendar-overview/accounts",
    world: { calendars: "none", groups: "some" },
  },
  { name: "profile", path: "/profile" },
  { name: "my-data", path: "/profile/data" },
];

for (const { name, path, world, signedIn } of PAGES) {
  test.describe(name, () => {
    if (world) test.use({ world });
    if (signedIn === false) test.use({ signedIn: false });

    test(`looks as it did`, async ({ page, isMobile }) => {
      test.skip(isMobile && name === "event-vote", "a phone has no open event beside the list");
      await page.goto(path);
      await expectPage(page, name, isMobile);
    });
  });
}

test("the swipe screen looks as it did", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phones only: a computer answers beside the list (event-vote)");
  await page.goto("/events/ev-boardgames/dates");
  await expect(page.getByText("Dato 1 af 3", { exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  // This screen fills the phone's screen, as it is meant to: no taller page.
  await expect(page).toHaveScreenshot("swipe.png");
});
