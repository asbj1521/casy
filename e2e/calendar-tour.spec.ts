/**
 * The guided calendar setup (#221, the app only): offered once after the home
 * page has nothing else to ask, your calendars one at a time, and always there
 * again under Kalendere.
 */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "the app is a phone"));

async function asTheApp(page: Page, offered: boolean) {
  await page.addInitScript((seen) => {
    (window as unknown as { Capacitor: object }).Capacitor = { isNativePlatform: () => true };
    // Once per tab, so what the app remembers then stands.
    if (!seen && !sessionStorage.getItem("tour-cleared")) {
      localStorage.removeItem("casy-calendar-tour-offered:p-mia");
      sessionStorage.setItem("tour-cleared", "1");
    }
  }, offered);
}

const tour = (page: Page) => page.getByRole("dialog", { name: "Dine kalendere" });

/** These calendars aren't this phone's, so the app first offers to import it. */
const importPutAway = (page: Page) => page.getByRole("button", { name: "Ikke nu" }).click();

test("it is offered once, and Annuller means it isn't offered again", async ({ page }) => {
  await asTheApp(page, false);
  await page.goto("/");
  await importPutAway(page);
  await expect(tour(page)).toBeVisible();
  await tour(page).getByRole("button", { name: "Annuller" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await importPutAway(page);
  await page.waitForTimeout(1200);
  await expect(tour(page)).toHaveCount(0);
});

test("the website never offers it", async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem("casy-calendar-tour-offered:p-mia"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Planlæg" })).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(tour(page)).toHaveCount(0);
});

test("from Kalendere it goes through every calendar and saves what was chosen", async ({
  page,
  backend,
}) => {
  await asTheApp(page, true);
  await page.goto("/");
  await importPutAway(page);
  await page.getByRole("button", { name: "Kalendere" }).click();
  await page.getByRole("button", { name: "Gennemgå kalendere" }).click();
  await expect(tour(page)).toBeVisible();

  const sources = backend.world.connections.flatMap((c) => c.calendar_sources);
  const steps = tour(page).getByRole("button", { name: /^Kalender \d+ af \d+$/ });
  const count = await steps.count();
  expect(count).toBe(sources.length);

  // The first card: a kind, and the slider at its top stop.
  await tour(page).getByRole("radio", { name: "Skole" }).check({ force: true });
  await tour(page).getByRole("slider").fill("3");
  await expect(tour(page).getByRole("slider")).toHaveAttribute(
    "aria-valuetext",
    "Spring aldrig over",
  );
  await tour(page)
    .getByRole("button", { name: count > 1 ? "Næste" : "Færdig" })
    .click();
  await expect
    .poll(() => {
      const first = sources[0];
      return [first.purpose, first.priority];
    })
    .toEqual(["school", "never"]);

  for (let i = 1; i < count; i++) {
    await tour(page)
      .getByRole("button", { name: i + 1 === count ? "Færdig" : "Næste" })
      .click();
  }
  await expect(page.getByText("Så er dine kalendere klar")).toBeVisible();
  await page.getByRole("button", { name: "Se min kalender" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("the slider's lowest stop switches a calendar off", async ({ page, backend }) => {
  await asTheApp(page, true);
  await page.goto("/?tour");
  await expect(tour(page)).toBeVisible();
  await tour(page).getByRole("slider").fill("0");
  await expect(tour(page).getByText("Tæller ikke med")).toBeVisible();
  const steps = await tour(page)
    .getByRole("button", { name: /^Kalender \d+ af \d+$/ })
    .count();
  await tour(page)
    .getByRole("button", { name: steps > 1 ? "Næste" : "Færdig" })
    .click();
  const first = backend.world.connections.flatMap((c) => c.calendar_sources)[0];
  await expect.poll(() => (first as { included?: boolean }).included).toBe(false);
});

test("Casy's guess is ticked and marked, and Næste alone makes it the person's own", async ({
  page,
  backend,
}) => {
  const first = backend.world.connections.flatMap((c) => c.calendar_sources)[0];
  first.purpose = "work";
  first.purpose_source = "ai";
  await asTheApp(page, true);
  await page.goto("/?tour");
  await expect(tour(page).getByRole("radio", { name: "Arbejde" })).toBeChecked();
  await expect(tour(page).getByText("gættet")).toBeVisible();
  await tour(page).getByRole("button", { name: "Næste" }).click();
  await expect.poll(() => first.purpose_source).toBe("user");
  expect(first.purpose).toBe("work");
});

test("a bar goes back to a calendar already done", async ({ page }) => {
  await asTheApp(page, true);
  await page.goto("/?tour");
  await expect(tour(page)).toBeVisible();
  const steps = tour(page).getByRole("button", { name: /^Kalender \d+ af \d+$/ });
  test.skip((await steps.count()) < 2, "needs two calendars");
  await expect(steps.nth(0)).toHaveAttribute("aria-current", "step");
  await tour(page).getByRole("button", { name: "Næste" }).click();
  await expect(steps.nth(1)).toHaveAttribute("aria-current", "step");
  await steps.nth(0).click();
  await expect(steps.nth(0)).toHaveAttribute("aria-current", "step");
});
