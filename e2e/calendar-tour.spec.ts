/**
 * The guided calendar setup (#221, the app only): never by itself; a count on
 * Kalendere and a row inside it lead to it, your calendars one at a time.
 */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import type { FakeBackend } from "./backend";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "the app is a phone"));

async function asTheApp(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { Capacitor: object }).Capacitor = { isNativePlatform: () => true };
  });
}

const tour = (page: Page) => page.getByRole("dialog", { name: "Dine kalendere" });
const sources = (backend: FakeBackend) =>
  backend.world.connections.flatMap((c) => c.calendar_sources);
/** Every calendar has a category of its owner's: nothing is waiting. */
const allSorted = (backend: FakeBackend) => {
  for (const s of sources(backend)) {
    s.purpose = s.purpose ?? "other";
    s.purpose_source = "user";
  }
};
/** These calendars aren't this phone's, so the app first offers to import it. */
const importPutAway = (page: Page) => page.getByRole("button", { name: "Ikke nu" }).click();
const steps = (page: Page) => tour(page).getByRole("button", { name: /^Kalender \d+ af \d+$/ });

test("it never opens by itself: Kalendere counts what isn't set up, and leads to it", async ({
  page,
  backend,
}) => {
  await asTheApp(page);
  await page.goto("/");
  await importPutAway(page);
  await page.waitForTimeout(1200);
  await expect(tour(page)).toHaveCount(0);

  // One calendar in this world has no category.
  const unsorted = sources(backend).filter((s) => s.purpose === null);
  expect(unsorted).toHaveLength(1);
  const button = page.getByRole("button", { name: "Kalendere 1 kalender er ikke sat op" });
  await expect(button).toBeVisible();
  await button.click();
  await page.getByRole("button", { name: /Gennemgå kalendere.*1 kalender/ }).click();

  // Only that one, and once it has one, the count is gone.
  await expect(steps(page)).toHaveCount(1);
  await tour(page).getByRole("radio", { name: "Skole" }).check();
  await tour(page).getByRole("button", { name: "Færdig" }).click();
  await expect.poll(() => unsorted[0].purpose).toBe("school");
  await expect(page.getByText("Så er dine kalendere klar")).toBeVisible();
  await page.getByRole("button", { name: "Se min kalender" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Kalendere", exact: true })).toBeVisible();
});

test("one left without a category isn't counted again", async ({ page }) => {
  await asTheApp(page);
  await page.goto("/");
  await importPutAway(page);
  await page.getByRole("button", { name: "Kalendere 1 kalender" }).click();
  await page.getByRole("button", { name: /Gennemgå kalendere/ }).click();
  await tour(page).getByRole("button", { name: "Færdig" }).click();
  await page.getByRole("button", { name: "Se min kalender" }).click();
  await page.reload();
  await importPutAway(page);
  await expect(page.getByRole("button", { name: "Kalendere", exact: true })).toBeVisible();
});

test("Casy's guess counts, is ticked and marked, and Næste makes it the person's own", async ({
  page,
  backend,
}) => {
  allSorted(backend);
  const first = sources(backend)[0];
  first.purpose = "work";
  first.purpose_source = "ai";
  await asTheApp(page);
  await page.goto("/?tour");
  await expect(steps(page)).toHaveCount(1);
  await expect(tour(page).getByRole("radio", { name: "Arbejde" })).toBeChecked();
  await expect(tour(page).getByText("gættet")).toBeVisible();
  await tour(page).getByRole("button", { name: "Færdig" }).click();
  await expect.poll(() => first.purpose_source).toBe("user");
  expect(first.purpose).toBe("work");
});

test("with nothing waiting, it goes through every calendar", async ({ page, backend }) => {
  allSorted(backend);
  await asTheApp(page);
  await page.goto("/");
  await importPutAway(page);
  await page.getByRole("button", { name: "Kalendere", exact: true }).click();
  await page.getByRole("button", { name: /Gennemgå kalendere.*Én ad gangen/ }).click();
  await expect(steps(page)).toHaveCount(sources(backend).length);
});

test("the slider saves its stop, and the lowest switches a calendar off", async ({
  page,
  backend,
}) => {
  allSorted(backend);
  const [first, second] = sources(backend);
  await asTheApp(page);
  await page.goto("/?tour");
  await tour(page).getByRole("slider").fill("3");
  await expect(tour(page).getByRole("slider")).toHaveAttribute(
    "aria-valuetext",
    "Spring aldrig over",
  );
  await tour(page).getByRole("button", { name: "Næste" }).click();
  await expect.poll(() => first.priority).toBe("never");
  await tour(page).getByRole("slider").fill("0");
  await expect(tour(page).getByText("Tæller ikke med")).toBeVisible();
  await tour(page).getByRole("button", { name: "Næste" }).click();
  await expect.poll(() => (second as { included?: boolean }).included).toBe(false);
});

test("a bar goes back to a calendar already done", async ({ page, backend }) => {
  allSorted(backend);
  await asTheApp(page);
  await page.goto("/?tour");
  await expect(steps(page).nth(0)).toHaveAttribute("aria-current", "step");
  await tour(page).getByRole("button", { name: "Næste" }).click();
  await expect(steps(page).nth(1)).toHaveAttribute("aria-current", "step");
  await steps(page).nth(0).click();
  await expect(steps(page).nth(0)).toHaveAttribute("aria-current", "step");
});

test("the website has none of it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Kalendere", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Kalendere", exact: true }).click();
  await expect(page.getByRole("button", { name: /Gennemgå kalendere/ })).toHaveCount(0);
});
