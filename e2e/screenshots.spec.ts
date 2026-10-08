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
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import type { WorldOptions } from "./world";

test.skip(
  process.platform !== "linux" && !process.env.SCREENSHOTS_ANY_PLATFORM,
  "reference images are made on Linux (e2e/README.md)",
);

/**
 * One font for every image, whatever the machine has: the site uses the
 * system's own (Tailwind's font-sans), and Linux has no San Francisco, nor a
 * dependable bold. Inter (an npm package, served by the test itself) is
 * close to Apple's font and has every weight, so a weight change shows.
 */
const INTER = readFileSync(
  createRequire(import.meta.url).resolve(
    "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  ),
);

test.beforeEach(async ({ page }) => {
  await page.route("https://fonts.test/inter.woff2", (route) =>
    route.fulfill({ body: INTER, contentType: "font/woff2" }),
  );
});

async function useInter(page: Page) {
  await page.addStyleTag({
    content: `
      @font-face {
        font-family: "Inter Test";
        src: url("https://fonts.test/inter.woff2") format("woff2");
        font-weight: 100 900;
      }
      html { font-family: "Inter Test", sans-serif; }`,
  });
  await page.evaluate(() => document.fonts.ready);
}

/**
 * The whole page in one image. A phone's tab bar is pinned to the bottom of
 * the screen, so the screen is made as tall as the page first; otherwise it
 * would be drawn halfway down.
 */
async function expectPage(page: Page, name: string, isMobile: boolean) {
  await page.waitForLoadState("networkidle");
  await useInter(page);
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

// The phone's scheduling flow (#101): the first step is "scheduler" above.
for (const step of ["what", "details", "dates"]) {
  test(`the scheduling flow's ${step} step looks as it did`, async ({ page, isMobile }) => {
    test.skip(!isMobile, "phones only: a computer has the whole page at once");
    await page.goto(`/?step=${step}`);
    await expect(page.getByText(/^Trin \d af 4$/)).toBeVisible();
    await expectPage(page, `scheduler-${step}`, isMobile);
  });
}

test("the swipe screen looks as it did", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phones only: a computer answers beside the list (event-vote)");
  await page.goto("/events/ev-boardgames/dates");
  await expect(page.getByText("Dato 1 af 3", { exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await useInter(page);
  // This screen fills the phone's screen, as it is meant to: no taller page.
  await expect(page).toHaveScreenshot("swipe.png");
});
