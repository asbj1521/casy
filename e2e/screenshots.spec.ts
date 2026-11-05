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

test.beforeEach(async ({ page, isMobile }) => {
  await page.route("https://fonts.test/inter.woff2", (route) =>
    route.fulfill({ body: INTER, contentType: "font/woff2" }),
  );
  if (!isMobile) {
    await page.addInitScript(keepWidthAnswers);
    await page.addInitScript(ignoreCaptureWindow);
  }
});

/**
 * A computer's width queries keep the answer they first gave (#195). To draw
 * the whole page, Chrome shrinks the window to 1x1 for a moment mid-capture,
 * which reads as a phone: Your data and an open event then moved to their
 * phone address at / and were drawn as the scheduler. These tests never
 * change a computer's width, so nothing real is lost. Runs in the page.
 */
function keepWidthAnswers() {
  const real = window.matchMedia.bind(window);
  const answers = new Map<string, boolean>();
  window.matchMedia = (query) => {
    if (!query.includes("width")) return real(query);
    if (!answers.has(query)) answers.set(query, real(query).matches);
    const quiet = () => undefined;
    return {
      matches: answers.get(query)!,
      media: query,
      onchange: null,
      addEventListener: quiet,
      removeEventListener: quiet,
      addListener: quiet,
      removeListener: quiet,
      dispatchEvent: () => false,
    };
  };
}

/**
 * The page takes no notice of that 1x1 moment (#209). Measuring it made a
 * fitted day calendar (DayColumns, useFillViewport) work out its hours from a
 * window that isn't there, and the picture could be taken before it had
 * measured again: the calendar squashed, then "failed to take two consecutive
 * stable screenshots" with the page in fact matching its reference. With
 * nothing changed during the moment, there is nothing to catch up on. Runs in
 * the page, before any of its own listeners.
 */
function ignoreCaptureWindow() {
  const capturing = () => window.innerWidth <= 1;
  window.addEventListener(
    "resize",
    (event) => {
      if (capturing()) event.stopImmediatePropagation();
    },
    true,
  );
  const Real = window.ResizeObserver;
  window.ResizeObserver = class extends Real {
    constructor(callback: ResizeObserverCallback) {
      super((entries, observer) => {
        if (!capturing()) callback(entries, observer);
      });
    }
  };
}

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
 * The whole page in one image. Some of a phone's page is pinned to the bottom
 * of the screen (the home page's buttons), so the screen is made as tall as
 * the page first; otherwise it would be drawn halfway down. `phoneSheet`: on
 * a phone the address opens a sheet over the home page (#169), waited for.
 */
async function expectPage(
  page: Page,
  name: string,
  isMobile: boolean,
  path: string,
  phoneSheet = false,
) {
  if (isMobile && phoneSheet) await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await useInter(page);
  // Placeholders (ui/Bone.tsx) gone: the data has arrived and been drawn.
  await expect(page.locator(".animate-pulse")).toHaveCount(0);
  // Spinners too (#194): Your data says "Henter dine data" with one rather
  // than placeholders, and was drawn mid-load when the runner was busy.
  await expect(page.locator(".animate-spin")).toHaveCount(0);
  // Still on the page asked for (#194): a computer's page that wandered to
  // the scheduler at / (keepWidthAnswers, #195) would otherwise be saved as
  // the reference by --update-snapshots without a word. Kept as a guard.
  // Not a phone's: its addresses lead into the home page's sheets on purpose.
  if (!isMobile) expect(new URL(page.url()).pathname).toBe(path);
  if (isMobile) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 390, height });
    await expect(page).toHaveScreenshot(`${name}.png`);
  } else {
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  }
}

const PAGES: {
  name: string;
  path: string;
  world?: WorldOptions;
  signedIn?: boolean;
  /** On a phone, a sheet over the home page (#169). */
  phoneSheet?: boolean;
}[] = [
  { name: "landing", path: "/", signedIn: false },
  { name: "scheduler", path: "/" },
  { name: "scheduler-examples", path: "/", world: { calendars: "connected", groups: "none" } },
  // On a phone, screens in the Profil sheet (#174).
  { name: "groups", path: "/groups", phoneSheet: true },
  { name: "group", path: "/groups/g-friday", phoneSheet: true },
  { name: "events", path: "/events", phoneSheet: true },
  { name: "event-vote", path: "/events/ev-boardgames" },
  // On a phone, an agreed event's screen in the Aftaler sheet (#177).
  { name: "event-agreed", path: "/events/ev-party", phoneSheet: true },
  { name: "calendar", path: "/calendar-overview" },
  { name: "calendars-connected", path: "/calendar-overview/accounts" },
  {
    name: "calendars-none",
    path: "/calendar-overview/accounts",
    world: { calendars: "none", groups: "some" },
  },
  { name: "profile", path: "/profile", phoneSheet: true },
  { name: "my-data", path: "/profile/data", phoneSheet: true },
];

for (const { name, path, world, signedIn, phoneSheet } of PAGES) {
  test.describe(name, () => {
    if (world) test.use({ world });
    if (signedIn === false) test.use({ signedIn: false });

    test(`looks as it did`, async ({ page, isMobile }) => {
      test.skip(isMobile && name === "event-vote", "a phone has no open event beside the list");
      test.skip(
        !isMobile && name === "event-agreed",
        "a computer's open event is event-vote's pane",
      );
      test.skip(isMobile && name.startsWith("scheduler"), "a phone plans from My calendar (#127)");
      await page.goto(path);
      await expectPage(page, name, isMobile, path, phoneSheet);
    });
  });
}

// Dark mode (#93), following the system: the main pages again, and the swipe
// screen, whose calendar blocks are coloured in code (lib/tint.ts).
const DARK_PAGES = [
  "landing",
  "scheduler",
  "groups",
  "events",
  "event-vote",
  "event-agreed",
  "calendar",
  "calendars-connected",
  "profile",
];

test.describe("dark", () => {
  test.use({ colorScheme: "dark" });

  for (const { name, path, world, signedIn, phoneSheet } of PAGES.filter((p) =>
    DARK_PAGES.includes(p.name),
  )) {
    test.describe(name, () => {
      if (world) test.use({ world });
      if (signedIn === false) test.use({ signedIn: false });

      test(`looks as it did, dark`, async ({ page, isMobile }) => {
        test.skip(isMobile && name === "event-vote", "a phone has no open event beside the list");
        test.skip(
          !isMobile && name === "event-agreed",
          "a computer's open event is event-vote's pane",
        );
        test.skip(
          isMobile && name.startsWith("scheduler"),
          "a phone plans from My calendar (#127)",
        );
        await page.goto(path);
        await expectPage(page, `${name}-dark`, isMobile, path, phoneSheet);
      });
    });
  }

  test("the day view looks as it did, dark", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phones only: a computer's day opens in a popover");
    await page.goto(DAY_VIEW);
    await expectDayView(page, "calendar-day-dark.png");
  });

  test("the swipe screen looks as it did, dark", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phones only: a computer answers beside the list (event-vote)");
    await page.goto("/events/ev-boardgames/dates");
    await expect(page.getByText("Dato 1 af 3", { exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await useInter(page);
    await expect(page).toHaveScreenshot("swipe-dark.png");
  });
});

test("the swipe screen looks as it did", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phones only: a computer answers beside the list (event-vote)");
  await page.goto("/events/ev-boardgames/dates");
  await expect(page.getByText("Dato 1 af 3", { exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await useInter(page);
  // This screen fills the phone's screen, as it is meant to: no taller page.
  await expect(page).toHaveScreenshot("swipe.png");
});

test("the picture crop sheet looks as it did (#190)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phones only: the design language's sheet");
  await page.goto("/profile");
  await expect(page.getByRole("button", { name: "Tilføj profilbillede" })).toBeVisible();
  // A made-up photo, the same on every run: an orange to blue sky and a pale sun off to the side.
  const photo = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 400;
    const context = canvas.getContext("2d")!;
    const sky = context.createLinearGradient(0, 0, 600, 400);
    sky.addColorStop(0, "#f97316");
    sky.addColorStop(1, "#1e3a8a");
    context.fillStyle = sky;
    context.fillRect(0, 0, 600, 400);
    context.fillStyle = "#fde68a";
    context.beginPath();
    context.arc(420, 160, 80, 0, 2 * Math.PI);
    context.fill();
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    buffer: Buffer.from(photo, "base64"),
  });
  // Once the sheet has slid up and stands still (hover waits for that).
  await page.getByLabel(/^Billedet\./).hover();
  await page.waitForLoadState("networkidle");
  await useInter(page);
  await expect(page).toHaveScreenshot("picture-crop.png");
});

// The home page's day view (#176), on today: the now-line, the week row's red circle.
const DAY_VIEW = "/?day=2026-10-07";

async function expectDayView(page: Page, file: string) {
  await expect(page.getByText("onsdag 7. okt. 2026")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await useInter(page);
  await expect(page).toHaveScreenshot(file);
}

test("the day view looks as it did", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phones only: a computer's day opens in a popover");
  await page.goto(DAY_VIEW);
  await expectDayView(page, "calendar-day.png");
});
