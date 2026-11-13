/**
 * The App Store's screenshots (#271), made rather than tested: only with
 * APPSTORE_SHOTS=1 (`npm run appstore:shots`). The app's own screens, drawn
 * as the app at a 6.9 inch iPhone's size (440 x 956 points, 1320 x 2868
 * pixels) over the test backend's made-up groups, then each set on a slide
 * with a line above it, in Danish and English. The first slide is only the
 * name. Written to docs/app-store/screenshots/<lang>/.
 */
import { mkdirSync, readFileSync } from "node:fs";

import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { ME } from "./world";

test.skip(!process.env.APPSTORE_SHOTS, "made on demand: npm run appstore:shots");
test.skip(({ isMobile }) => !isMobile, "the app is a phone");

test.use({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 });

const OUT = "docs/app-store/screenshots";
const RAW = "test-results/appstore-raw";

const LINES = {
  home: { da: "Alles kalendere. Én måned.", en: "Everyone's calendars. One month." },
  vote: { da: "Stem på de dage, vi finder", en: "Vote on the days we find" },
  agreed: { da: "Datoen lander i alles kalender", en: "The date lands in everyone's calendar" },
  group: { da: "En gruppe til hver flok", en: "A group for every crowd" },
};

/** The app, not the website: no header, as on the phone. */
async function asTheApp(page: Page) {
  await page.addInitScript((me) => {
    (window as unknown as { Capacitor: object }).Capacitor = { isNativePlatform: () => true };
    // This phone already connected (its Apple account), so the calendar step stays away.
    localStorage.setItem(`casy-phone-calendar:${me}`, "conn-apple");
  }, ME.id);
}

async function settled(page: Page) {
  // Quiet enough: the English page keeps a request going, so this waits no longer than it must.
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await expect(page.locator(".animate-pulse")).toHaveCount(0);
  await expect(page.locator(".animate-spin")).toHaveCount(0);
  await page.waitForTimeout(3000);
}

const SCREENS: { name: keyof typeof LINES; path: string; ready: (page: Page) => Promise<void> }[] =
  [
    {
      name: "home",
      path: "/",
      ready: (page) => expect(page.getByRole("button", { name: /^(Planlæg|Plan)$/ })).toBeVisible(),
    },
    {
      name: "vote",
      path: "/?vote=ev-boardgames",
      ready: (page) => expect(page).toHaveURL(/vote=ev-boardgames/),
    },
    {
      name: "agreed",
      path: "/events/ev-party",
      ready: (page) => expect(page.getByRole("dialog")).toBeVisible(),
    },
    {
      name: "group",
      path: "/groups/g-friday",
      ready: (page) => expect(page.getByRole("dialog")).toBeVisible(),
    },
  ];

for (const lang of ["da", "en"] as const) {
  for (const { name, path, ready } of SCREENS) {
    test(`${lang} ${name}`, async ({ page }) => {
      await asTheApp(page);
      await page.goto(`${path}${path.includes("?") ? "&" : "?"}lang=${lang}`);
      await ready(page);
      await settled(page);
      mkdirSync(RAW, { recursive: true });
      await page.screenshot({ path: `${RAW}/${lang}-${name}.png` });
    });
  }
}

/** The slides: the bubbles, a line, and the screen in a phone's rounded corners. */
test.describe.serial("slides", () => {
  for (const lang of ["da", "en"] as const) {
    test(`${lang}`, async ({ page }) => {
      mkdirSync(`${OUT}/${lang}`, { recursive: true });
      const logo = readFileSync("docs/brand/icon-letters.svg", "utf8");
      // 1: only the name.
      await page.setContent(slide(`<div class="name">${logo}</div>`));
      await page.screenshot({ path: `${OUT}/${lang}/1-name.png` });
      let n = 2;
      for (const { name } of SCREENS) {
        const shot = readFileSync(`${RAW}/${lang}-${name}.png`).toString("base64");
        await page.setContent(
          slide(
            `<p class="line">${LINES[name][lang]}</p>` +
              `<img class="screen" src="data:image/png;base64,${shot}">`,
          ),
        );
        await page.waitForTimeout(100);
        await page.screenshot({ path: `${OUT}/${lang}/${n++}-${name}.png` });
      }
    });
  }
});

function slide(body: string) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    html, body { margin: 0; width: 440px; height: 956px; overflow: hidden; }
    body { position: relative; background: #FF4D00; font-family: -apple-system, system-ui, sans-serif; }
    .b { position: absolute; border-radius: 50%; }
    .name { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
    .name svg { width: 78%; height: auto; }
    .name svg path, .name svg * { fill: #fff; }
    .line { position: absolute; left: 32px; right: 32px; top: 70px; margin: 0; color: #fff;
      font-size: 38px; line-height: 1.08; font-weight: 800; text-align: center; letter-spacing: -0.01em; text-wrap: balance; }
    .screen { position: absolute; left: 50%; top: 210px; width: 360px; transform: translateX(-50%);
      border-radius: 46px; border: 7px solid #111; box-shadow: 0 30px 60px rgb(0 0 0 / 0.3); }
  </style></head><body>
    <div class="b" style="width:620px;height:620px;left:-260px;top:520px;background:radial-gradient(circle at 30% 25%, #fde68a, #ffd60a 50%, #fbbf24)"></div>
    <div class="b" style="width:560px;height:560px;left:180px;top:-200px;background:radial-gradient(circle at 30% 25%, #fb7185, #ff2d78 50%, #e11d48)"></div>
    <div class="b" style="width:520px;height:520px;left:160px;top:640px;background:radial-gradient(circle at 30% 25%, #fdba74, #fb923c 45%, #f43f5e)"></div>
    ${body}
  </body></html>`;
}
