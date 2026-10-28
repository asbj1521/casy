/** The phone layout: the tab bar, and screens that open with a back button. */
import { expect, test } from "./fixtures";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "phones only"));

test("the tab bar reaches every main page, and planning lives in the calendar (#127)", async ({
  page,
}) => {
  // Signed in, the home screen is My calendar: a phone plans from there.
  await page.goto("/");
  await expect(page).toHaveURL(/\/calendar-overview$/);
  const tabs = page.getByRole("navigation").last();
  // Three tabs, the calendar in the middle (the outer two may carry a count).
  await expect(tabs.getByRole("link")).toHaveText([/Aftaler$/, "Kalender", /Profil$/]);
  for (const [tab, url] of [
    ["Aftaler", /\/events$/],
    ["Profil", /\/profile$/],
    ["Kalender", /\/calendar-overview$/],
  ] as const) {
    await tabs.getByRole("link", { name: tab }).click();
    await expect(page).toHaveURL(url);
  }
  // The scheduler's own address leads there too.
  await page.goto("/plan");
  await expect(page).toHaveURL(/\/calendar-overview$/);
});

test("groups are a row of the profile, under Settings, and the Profile tab stays lit", async ({
  page,
}) => {
  await page.goto("/profile");
  const tabs = page.getByRole("navigation").last();
  // Settings, then Groups, then Sign-in and security, in that order.
  const rows = page.getByRole("link", { name: /^(Indstillinger|Grupper|Log ind og sikkerhed)/ });
  await expect(rows).toHaveText([/Indstillinger/, /Grupper/, /Log ind og sikkerhed/]);
  // The invitation waiting is counted on the row and on the tab that leads to it.
  await expect(page.getByRole("link", { name: /^Grupper/ })).toContainText("1");
  await expect(tabs.getByRole("link", { name: /Profil/ })).toContainText("1");

  await page.getByRole("link", { name: /^Grupper/ }).click();
  await expect(page).toHaveURL(/\/groups$/);
  await expect(tabs.getByRole("link", { name: /Profil/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Badminton")).toBeVisible();
  // A screen under the profile, with a way back to it.
  await page
    .getByRole("link", { name: /Profil/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/profile$/);
});

test("the profile's screens open and go back", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("link", { name: "Log ind og sikkerhed" }).click();
  await expect(page).toHaveURL(/\/profile\/password$/);
  await page
    .getByRole("link", { name: /Profil/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/profile$/);
});

test("My calendar is a month like Apple's: a day opens its busy time, Kalendere the list", async ({
  page,
}) => {
  await page.goto("/calendar-overview");
  // A tapped day's busy time slides up with the month still live behind it:
  // another day can be tapped at once, and a blank part of the month closes it.
  await page.getByRole("button", { name: "torsdag 1. oktober" }).click();
  await expect(page.getByRole("region", { name: "Torsdag 1. oktober" })).toBeVisible();
  await page.getByRole("button", { name: "fredag 2. oktober" }).click();
  await expect(page.getByRole("region", { name: "Fredag 2. oktober" })).toBeVisible();
  await page.getByRole("heading", { name: "Oktober", exact: true }).click();
  await expect(page.getByRole("region", { name: "Fredag 2. oktober" })).toBeHidden();

  await page.getByRole("button", { name: "Kalendere" }).click();
  await expect(page.getByRole("heading", { name: "Dine kalendere" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Forbundne kalendere/ })).toBeVisible();

  // One step back from "Connected calendars" lands on the sheet, not the bare month.
  await page.getByRole("link", { name: /Forbundne kalendere/ }).click();
  await expect(page).toHaveURL(/\/calendar-overview\/accounts$/);
  // The page's own back link, in its header: until the page has loaded, the
  // tab bar's Kalender (the bare month) is the only one there.
  await page.getByRole("banner").getByRole("link", { name: "Kalender" }).click();
  await expect(page.getByRole("heading", { name: "Dine kalendere" })).toBeVisible();
});

test("My calendar's month name stays on top and follows the scroll", async ({ page }) => {
  await page.goto("/calendar-overview");
  const title = page.getByRole("heading", { name: "Oktober", exact: true });
  await expect(title).toBeVisible();
  const before = await title.boundingBox();

  // November's first week comes up under the header: the title changes, and stays where it was.
  await page.locator("[data-floating-header]").evaluate((box) => {
    const pad = parseFloat((box as HTMLElement).style.scrollPaddingTop);
    const next = box.querySelector<HTMLElement>("[data-month]:nth-of-type(2)")!;
    box.scrollTop = next.offsetTop + 28 - pad;
  });
  const november = page.getByRole("heading", { name: "November", exact: true });
  await expect(november).toBeVisible();
  await expect(title).toHaveCount(0);
  expect(await november.boundingBox()).toEqual(before);
});

test("in the app, the phone's own calendars come first and Google and Outlook wait (#141)", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { Capacitor: object }).Capacitor = { isNativePlatform: () => true };
  });
  await page.goto("/calendar-overview/accounts");
  const add = page.getByRole("list").filter({ has: page.getByText("Denne telefon") });
  await expect(add.getByRole("button", { name: /Denne telefon/ })).toBeVisible();
  await expect(add.getByRole("button", { name: /^Apple-kalender/ })).toHaveCount(0);
  await expect(add.getByRole("button", { name: /Google Kalender/ })).toHaveCount(0);

  await add.getByRole("button", { name: /Andre måder at forbinde/ }).click();
  await expect(add.getByRole("button", { name: /^Apple-kalender/ })).toBeVisible();
  await expect(add.getByRole("button", { name: /^Kalenderlink/ })).toBeVisible();
  await expect(add.getByRole("button", { name: /Google Kalender|Outlook-kalender/ })).toHaveCount(
    0,
  );
});

test.describe("short pages", () => {
  test.use({ world: { calendars: "connected", groups: "none" } });

  test("a page with little on it doesn't scroll into nothing", async ({ page }) => {
    // The tab bar's room and the footer used to come on top of a page a whole
    // screen tall, so a short page could be scrolled by that much.
    for (const path of ["/groups", "/events"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const { scroll, screen } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollHeight,
        screen: window.innerHeight,
      }));
      expect(scroll, path).toBeLessThanOrEqual(screen);
    }
  });
});

test("the iPhone app has no logo at the top: the pages start there", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phones only");
  // The website's phone keeps its header with the logo.
  await page.goto("/events");
  await expect(page.getByRole("link", { name: "casy" })).toBeVisible();

  // The bridge the app injects before the page runs (src/lib/nativeApp.ts).
  await page.addInitScript(() => {
    (window as unknown as { Capacitor: object }).Capacitor = { isNativePlatform: () => true };
  });
  for (const path of ["/events", "/calendar-overview", "/profile"]) {
    await page.goto(path);
    await expect(page.getByRole("navigation").last()).toBeVisible();
    await expect(page.getByRole("link", { name: "casy" })).toHaveCount(0);
  }
});

test("the pages the profile's help list opens all have a way back to Profil", async ({ page }) => {
  for (const [row, path] of [
    ["Hjælp og kontakt", /\/support$/],
    ["Sådan virker det", /\/how-it-works$/],
    ["Vilkår", /\/terms$/],
    ["Privatliv", /\/privacy$/],
  ] as const) {
    await page.goto("/profile");
    await page.getByRole("link", { name: row }).click();
    await expect(page).toHaveURL(path);
    await page.getByRole("link", { name: "Profil" }).first().click();
    await expect(page).toHaveURL(/\/profile$/);
  }
});

test("in the app, I dag and a tap at the top of the screen glide My calendar back up (#168)", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "phones only");
  await page.addInitScript(() => {
    (window as unknown as { Capacitor: object }).Capacitor = { isNativePlatform: () => true };
  });
  await page.goto("/calendar-overview");
  const months = page.locator("[data-floating-header]");
  await expect(page.getByRole("button", { name: "I dag" })).toBeVisible();
  // Where the months open (this month at the top), and a mark to see the
  // list is the same one afterwards, not drawn afresh.
  const opening = await months.evaluate((el) => {
    el.dataset.same = "yes";
    return el.scrollTop;
  });
  const scrollDown = () => months.evaluate((el) => (el.scrollTop = 3000));
  const top = () => months.evaluate((el) => el.scrollTop);

  await scrollDown();
  await page.getByRole("button", { name: "I dag" }).click();
  await expect.poll(top).toBeCloseTo(opening, 0);

  // The tap the app passes on from iOS (StatusTapCatcher).
  await scrollDown();
  await page.evaluate(() => window.dispatchEvent(new Event("casy:status-tap")));
  await expect.poll(top).toBe(0);
  await expect(months).toHaveAttribute("data-same", "yes");
});
