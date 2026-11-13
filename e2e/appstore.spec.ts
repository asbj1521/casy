/**
 * The App Store's screenshots (#271), made rather than tested: only with
 * APPSTORE_SHOTS=1 (`npm run appstore:shots`). The app's own screens, drawn
 * as the app at a 6.9 inch iPhone's size (440 x 956 points, 1320 x 2868
 * pixels) over the test backend's made-up groups, then each set on a slide
 * with a line above it, in Danish and English. The first slide is only the
 * name. Written to the screenshots folder beside the code ("Casy App Store
 * screenshots light", kept out of git), as "1.1.0 Dansk" and "1.1.0 English".
 */
import { mkdirSync, readFileSync } from "node:fs";

import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { ME } from "./world";

test.skip(!process.env.APPSTORE_SHOTS, "made on demand: npm run appstore:shots");
test.skip(({ isMobile }) => !isMobile, "the app is a phone");

test.use({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 });

const OUT = "Casy App Store screenshots light";
const FOLDER = { da: "1.1.0 Dansk", en: "1.1.0 English" } as const;
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
      // A real iPhone's screen: the clock's strip and the home indicator's, under which the
      // app lays itself out (viewport-fit=cover in the app). iPhone 17 Pro Max's insets.
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setSafeAreaInsetsOverride", {
        insets: { top: 62, bottom: 34, left: 0, right: 0 },
      });
      await page.goto(`${path}${path.includes("?") ? "&" : "?"}lang=${lang}`);
      await ready(page);
      await settled(page);
      mkdirSync(RAW, { recursive: true });
      await page.screenshot({ path: `${RAW}/${lang}-${name}.png` });
    });
  }
}

/** The slides: the bubbles, a line, and the screen in a real iPhone, island and status bar. */
test.describe.serial("slides", () => {
  for (const lang of ["da", "en"] as const) {
    test(`${lang}`, async ({ page }) => {
      mkdirSync(`${OUT}/${FOLDER[lang]}`, { recursive: true });
      const logo = readFileSync("docs/brand/icon-letters.svg", "utf8");
      // 1: only the name.
      await page.setContent(slide(`<div class="name">${logo}</div>`));
      await page.screenshot({ path: `${OUT}/${FOLDER[lang]}/1-name.png` });
      let n = 2;
      for (const { name } of SCREENS) {
        const shot = readFileSync(`${RAW}/${lang}-${name}.png`).toString("base64");
        await page.setContent(slide(`<p class="line">${LINES[name][lang]}</p>${iphone(shot)}`));
        await page.waitForTimeout(100);
        await page.screenshot({ path: `${OUT}/${FOLDER[lang]}/${n++}-${name}.png` });
      }
    });
  }
});

/** The screen's own size in points (iPhone 17 Pro Max), and how big it stands on the slide. */
const SCREEN = { w: 440, h: 956, radius: 62 };
const K = 0.74;

/**
 * An iPhone drawn around the screen: titanium band, black border, the
 * Dynamic Island, and iOS's status bar (9:41, signal, Wi-Fi, battery), all in
 * the screen's own points and scaled down together.
 */
function iphone(shot: string) {
  const bezel = 13;
  const band = 4.5;
  const outerW = (SCREEN.w + 2 * (bezel + band)) * K;
  const outerH = (SCREEN.h + 2 * (bezel + band)) * K;
  return `<div class="device" style="width:${outerW}px;height:${outerH}px;border-radius:${(SCREEN.radius + bezel + band) * K}px">
    <div class="glass" style="inset:${band * K}px;border-radius:${(SCREEN.radius + bezel) * K}px">
      <div class="screen" style="left:${bezel * K}px;top:${bezel * K}px;width:${SCREEN.w}px;height:${SCREEN.h}px;transform:scale(${K});border-radius:${SCREEN.radius}px">
        <img src="data:image/png;base64,${shot}" width="${SCREEN.w}" height="${SCREEN.h}">
        <div class="status">
          <span class="time">9:41</span>
          <span class="icons">
            <svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="8" width="3.2" height="4" rx="1"/><rect x="5" y="5.5" width="3.2" height="6.5" rx="1"/><rect x="10" y="3" width="3.2" height="9" rx="1"/><rect x="15" y="0" width="3.2" height="12" rx="1"/></svg>
            <svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 2.3c2.4 0 4.6.9 6.3 2.5l1.2-1.2C14 1.6 11.4.6 8.5.6S3 1.6 1 3.6l1.2 1.2C3.9 3.2 6.1 2.3 8.5 2.3zm0 3.4c1.5 0 2.9.6 4 1.6l1.2-1.2c-1.4-1.3-3.2-2.1-5.2-2.1s-3.8.8-5.2 2.1l1.2 1.2c1.1-1 2.5-1.6 4-1.6zm0 3.4c.6 0 1.2.2 1.6.6L8.5 11.3 6.9 9.7c.4-.4 1-.6 1.6-.6z"/></svg>
            <svg width="28" height="13" viewBox="0 0 28 13"><rect x="0.5" y="0.5" width="24" height="12" rx="3.6" fill="none" stroke="currentColor" stroke-opacity=".4"/><rect x="2.5" y="2.5" width="20" height="8" rx="2"/><path d="M26 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2z" fill-opacity=".45"/></svg>
          </span>
        </div>
        <div class="island"></div>
      </div>
    </div>
  </div>`;
}

function slide(body: string) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    html, body { margin: 0; width: 440px; height: 956px; overflow: hidden; }
    body { position: relative; background: #FF4D00; font-family: -apple-system, system-ui, sans-serif; }
    .b { position: absolute; border-radius: 50%; }
    .name { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
    .name svg { width: 78%; height: auto; }
    .name svg path, .name svg * { fill: #fff; }
    .line { position: absolute; left: 32px; right: 32px; top: 64px; margin: 0; color: #fff;
      font-size: 38px; line-height: 1.08; font-weight: 800; text-align: center; letter-spacing: -0.01em; text-wrap: balance; }
    .device { position: absolute; left: 50%; top: 196px; transform: translateX(-50%);
      background: linear-gradient(90deg, #8c8f94 0%, #e6e7e9 6%, #b9bcc0 20%, #d9dadc 50%, #b9bcc0 80%, #e6e7e9 94%, #8c8f94 100%);
      box-shadow: 0 34px 70px rgb(0 0 0 / 0.32), 0 8px 18px rgb(0 0 0 / 0.18); }
    .glass { position: absolute; background: #0b0b0c; }
    .screen { position: absolute; transform-origin: 0 0; overflow: hidden; background: #fff; }
    .screen img { display: block; }
    .status { position: absolute; left: 0; right: 0; top: 0; height: 62px; display: flex; align-items: center;
      justify-content: space-between; padding: 0 32px 0 52px; color: #000; }
    .time { font-size: 17px; font-weight: 600; letter-spacing: -0.02em; margin-top: 4px; }
    .icons { display: flex; gap: 7px; align-items: center; margin-top: 4px; }
    .icons svg { fill: currentColor; }
    .island { position: absolute; left: 50%; top: 11px; width: 126px; height: 37px; margin-left: -63px;
      border-radius: 19px; background: #000; }
  </style></head><body>
    <div class="b" style="width:620px;height:620px;left:-260px;top:520px;background:radial-gradient(circle at 30% 25%, #fde68a, #ffd60a 50%, #fbbf24)"></div>
    <div class="b" style="width:560px;height:560px;left:180px;top:-200px;background:radial-gradient(circle at 30% 25%, #fb7185, #ff2d78 50%, #e11d48)"></div>
    <div class="b" style="width:520px;height:520px;left:160px;top:640px;background:radial-gradient(circle at 30% 25%, #fdba74, #fb923c 45%, #f43f5e)"></div>
    ${body}
  </body></html>`;
}
