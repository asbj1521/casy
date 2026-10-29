/** The phone layout: the home page and its buttons, and screens that open with a back button. */
import { expect, test } from "./fixtures";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "phones only"));

test("the home page is My calendar, its buttons reach the rest, and there is no tab bar (#169)", async ({
  page,
}) => {
  // Signed in, the home page is My calendar, at /: a phone plans from there.
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Planlæg" })).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  // Aftaler and Profil open as sheets over it, which Færdig and the phone's
  // back close; their old addresses lead to them. All on the one page, as it
  // is used (a second goto to the same address skews Chrome's animation clock
  // against performance.now(), and a sheet's exit then starts seconds late).
  for (const [button, url, title] of [
    ["Aftaler", /\/\?events$/, "Mine aftaler"],
    ["Profil", /\/\?profile$/, "Profil"],
  ] as const) {
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page).toHaveURL(url);
    const sheet = page.getByRole("dialog", { name: title });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Færdig" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(sheet).toBeVisible();
    await page.goBack();
    await expect(sheet).toHaveCount(0);
  }
  await page.goto("/events");
  await expect(page).toHaveURL(/\/\?events$/);
  await expect(page.getByRole("dialog", { name: "Mine aftaler" })).toBeVisible();
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/\?profile$/);
  await expect(page.getByRole("dialog", { name: "Profil" })).toBeVisible();
  // The scheduler's address and My calendar's old one lead home too.
  await page.goto("/plan");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/calendar-overview?calendars");
  await expect(page).toHaveURL(/\/\?calendars$/);
  await expect(page.getByRole("dialog", { name: "Kalendere" })).toBeVisible();
});

test("groups are a row of the profile, under Settings, its count on the home page's Profil", async ({
  page,
}) => {
  // The invitation waiting is counted on the button that leads to it.
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Profil", exact: true })).toContainText("1");

  await page.goto("/profile");
  // Settings, then Groups, then Sign-in and security, in that order.
  const rows = page.getByRole("link", { name: /^(Indstillinger|Grupper|Log ind og sikkerhed)/ });
  await expect(rows).toHaveText([/Indstillinger/, /Grupper/, /Log ind og sikkerhed/]);
  // And on the row.
  await expect(page.getByRole("link", { name: /^Grupper/ })).toContainText("1");

  await page.getByRole("link", { name: /^Grupper/ }).click();
  // A screen inside the Profil sheet (#174), with a way back to the profile.
  await expect(page).toHaveURL(/\?profile=groups$/);
  await expect(page.getByText("Badminton")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Profil" }).click();
  await expect(page).toHaveURL(/\/\?profile$/);
});

test("the profile's screens slide in inside the sheet, and go back (#174)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Profil", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("link", { name: "Log ind og sikkerhed" }).click();
  await expect(page).toHaveURL(/\?profile=password$/);
  await expect(sheet.getByRole("heading", { name: "Log ind og sikkerhed" })).toBeVisible();
  // The phone's back steps out of the screen, the sheet still open.
  await page.goBack();
  await expect(page).toHaveURL(/\?profile$/);
  await expect(sheet.getByRole("heading", { name: "Profil" })).toBeVisible();

  // Two screens deep, Færdig closes the whole sheet onto the plain month.
  await sheet.getByRole("link", { name: /^Grupper/ }).click();
  await sheet.getByRole("link", { name: /Løbeklubben/ }).click();
  await expect(page).toHaveURL(/\?profile=groups\/g-running$/);
  await sheet.getByRole("button", { name: "Færdig" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // The old addresses open the screen in the sheet.
  await page.goto("/profile/settings");
  await expect(page).toHaveURL(/\?profile=settings$/);
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Indstillinger" }),
  ).toBeVisible();
});

test("My calendar is a month like Apple's: a day zooms into its hours, Kalendere the list", async ({
  page,
}) => {
  await page.goto("/calendar-overview");
  // A tapped day opens as Apple's day view (#176), in the address, its busy
  // time over the hours and the home page's buttons out of the way.
  await page.getByRole("button", { name: "torsdag 1. oktober" }).click();
  await expect(page).toHaveURL(/\/\?day=2026-10-01$/);
  const view = page
    .getByRole("region")
    .filter({ has: page.getByRole("button", { name: "Vis Oktober" }) });
  await expect(view).toHaveAccessibleName("Torsdag 1. oktober");
  await expect(view.getByText("torsdag 1. okt. 2026")).toBeVisible();
  await expect(page.getByRole("button", { name: "Planlæg", exact: true })).toBeHidden();

  // A block opens its details.
  await view.getByRole("button", { name: /^Arbejde/ }).click();
  const details = page.getByRole("dialog", { name: "Torsdag 1. oktober" });
  await expect(details.getByText("08:30-16:00")).toBeVisible();
  await details.getByRole("button", { name: "Færdig" }).click();
  await expect(details).toBeHidden();

  // The week row moves it in place; two days, kept on this phone.
  await view.getByRole("button", { name: "2", exact: true }).click();
  await expect(page).toHaveURL(/\?day=2026-10-02$/);
  await view.getByRole("button", { name: "Vis to dage" }).click();
  await expect(view.getByText("fre. 2. okt.")).toBeVisible();
  await expect(view.getByText("lør. 3. okt.")).toBeVisible();
  await page.reload();
  await expect(view.getByText("lør. 3. okt.")).toBeVisible();
  await view.getByRole("button", { name: "Vis én dag" }).click();
  await expect(view.getByText("fredag 2. okt. 2026")).toBeVisible();

  // Back to the month, its buttons there again.
  await view.getByRole("button", { name: "Vis Oktober" }).click();
  await expect(view).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Planlæg", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Kalendere" }).click();
  await expect(page.getByRole("heading", { name: "Dine kalendere" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Forbundne kalendere/ })).toBeVisible();

  // One step back from "Connected calendars" lands on the sheet, not the bare month.
  await page.getByRole("link", { name: /Forbundne kalendere/ }).click();
  await expect(page).toHaveURL(/\/calendar-overview\/accounts$/);
  // The page's own back link, in its header, leads home with the sheet open.
  await page.getByRole("banner").getByRole("link", { name: "Hjem" }).click();
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
  for (const [path, shown] of [
    ["/events", page.getByRole("heading", { name: "Mine aftaler" })],
    ["/", page.getByRole("button", { name: "Planlæg" })],
    ["/profile", page.getByRole("link", { name: /^Indstillinger/ })],
  ] as const) {
    await page.goto(path);
    await expect(shown).toBeVisible();
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
    await expect(page).toHaveURL(/\/\?profile$/);
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

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("each sheet grows out of its button where it stands and shrinks back into it (#169)", async ({
    page,
  }) => {
    await page.goto("/");
    const height = page.viewportSize()!.height;
    for (const [button, title, done, edge] of [
      ["Aftaler", "Mine aftaler", "Færdig", "bottom"],
      ["Planlæg", "Planlæg", "Annuller", "bottom"],
      ["Profil", "Profil", "Færdig", "bottom"],
      ["Kalendere", "Kalendere", "Færdig", "top"],
      ["Fortæl Casy", "Fortæl Casy", "Færdig", "top"],
    ] as const) {
      await page.getByRole("button", { name: button, exact: true }).click();
      const sheet = page.getByRole("dialog", { name: title });
      await expect(sheet).toBeVisible();
      // Grown to its full size, standing on its own edge of the screen.
      await expect
        .poll(async () => {
          const box = await sheet.boundingBox();
          return box && Math.round(edge === "top" ? box.y : height - box.y - box.height);
        })
        .toBe(0);
      await sheet.getByRole("button", { name: done }).click();
      // Shrunk away, and gone from the page once it has.
      await expect(sheet).toHaveCount(0);
      await expect(page).toHaveURL(/\/$/);
    }
  });

  test("a profile screen slides in inside the sheet, which keeps its place and height (#174)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Profil", exact: true }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("heading", { name: "Profil" })).toBeVisible();
    // Measured once it has grown out of its button.
    await page.waitForTimeout(700);
    const before = (await sheet.boundingBox())!;
    await sheet.getByRole("link", { name: /^Grupper/ }).click();
    await expect(page).toHaveURL(/\?profile=groups$/);
    // The same height for the screen: it only slides in from the side.
    await page.waitForTimeout(500);
    expect(Math.round((await sheet.boundingBox())!.height)).toBe(Math.round(before.height));

    // Every frame on the way back: the same sheet, standing on the bottom edge.
    await page.evaluate(() => {
      const w = window as unknown as { bottoms: (number | null)[] };
      w.bottoms = [];
      const start = performance.now();
      const tick = () => {
        const d = document.querySelector<HTMLElement>('[role="dialog"]');
        w.bottoms.push(
          d ? Math.round(window.innerHeight - d.getBoundingClientRect().bottom) : null,
        );
        if (performance.now() - start < 1000) requestAnimationFrame(tick);
      };
      tick();
    });
    await sheet.getByRole("button", { name: "Profil" }).click();
    await expect(page).toHaveURL(/\/\?profile$/);
    await page.waitForTimeout(1100);
    const bottoms = await page.evaluate(() => (window as unknown as { bottoms: number[] }).bottoms);
    expect(new Set(bottoms)).toEqual(new Set([0]));
    // And still the same height.
    expect(Math.round((await sheet.boundingBox())!.height)).toBe(Math.round(before.height));
  });
});
