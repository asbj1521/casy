/**
 * The scheduling page: the answer for a real group, "Suggest dates" sending
 * it with the other good dates as a vote, and the layout (#98): on a wide
 * screen the answer and the settings side by side, as tall as each other,
 * with the chart still on the first screen of a laptop; on a phone the
 * sentence, with Flere indstillinger a tap away.
 */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { cph } from "./world";

test("suggesting sends the date on screen as a vote", async ({ page, backend }) => {
  await page.goto("/");
  await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
  await page.getByRole("textbox", { name: /Hvad skal I/i }).fill("Fredagsbar");
  await page.getByRole("button", { name: /^Foreslå( datoer)?$/ }).click();

  await expect.poll(() => backend.calls.find((c) => c.body.action === "suggest")).toBeTruthy();
  const sent = backend.calls.find((c) => c.body.action === "suggest")!.body;
  expect(sent).toMatchObject({ groupId: "g-friday", title: "Fredagsbar" });
  const dates = sent.dates as { start: string }[];
  expect(dates[0].start).toBe(cph("2026-10-07", "19:00"));
  expect(dates.length).toBeGreaterThan(1);
  expect(dates.length).toBeLessThanOrEqual(5);
});

test.describe("with no groups yet", () => {
  test.use({ world: { calendars: "connected", groups: "none" } });

  test("the example groups show instead", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Eksempel").filter({ visible: true }).first()).toBeVisible();
    await expect(
      page.getByText("Lav en gruppe for at foreslå aftaler til rigtige mennesker."),
    ).toBeVisible();
  });
});

/** The page's boxes, by what is in them. */
const answerBox = (page: Page) =>
  page
    .locator("section")
    .filter({ has: page.getByRole("heading", { level: 1 }) })
    .first();
const settingsBox = (page: Page) =>
  page.locator("section").filter({ has: page.getByRole("tablist") });
const chart = (page: Page) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name: /dag for dag/ }) });

async function boxOf(box: ReturnType<typeof chart>) {
  const b = await box.boundingBox();
  expect(b, "the box is on the page").not.toBeNull();
  return b!;
}

test.describe("on a laptop's screen", () => {
  // A typical laptop's browser window: the chart must fit in it whole.
  test.use({ viewport: { width: 1440, height: 800 } });
  test.beforeEach(({ isMobile }) => test.skip(isMobile, "computers only"));

  test("the answer and the settings sit side by side, as tall as each other, above the whole chart", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
    const answer = await boxOf(answerBox(page));
    const settings = await boxOf(settingsBox(page));
    expect(Math.abs(answer.y - settings.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(answer.height - settings.height)).toBeLessThanOrEqual(1);
    expect(settings.x).toBeGreaterThan(answer.x + answer.width);

    const { y, height } = await boxOf(chart(page));
    expect(y + height, "the chart's bottom edge is on the first screen").toBeLessThanOrEqual(800);
  });

  test("switching tabs never changes the settings box's height", async ({ page }) => {
    await page.goto("/");
    const before = (await boxOf(settingsBox(page))).height;
    for (const [tab, soon] of [
      ["Deltagere", true],
      ["Sted og note", false],
      ["Gentagelse", true],
      ["Afstemning", false],
      ["Hensyn", true],
    ] as const) {
      await page.getByRole("tab", { name: tab }).click();
      await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByText("Kommer snart").filter({ visible: true })).toHaveCount(
        soon ? 1 : 0,
      );
      expect((await boxOf(settingsBox(page))).height).toBe(before);
    }
    await page.getByRole("tab", { name: "Tidspunkt" }).click();
    await expect(page.getByRole("radio", { name: "Møde" })).toBeVisible();
  });

  test("Tur / ferie swaps the time for a number of days", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Varighed", { exact: true })).toBeVisible();
    await page.getByRole("radio", { name: "Tur / ferie" }).click();
    await expect(page.getByRole("radio", { name: "Tur / ferie" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByText("Antal dage", { exact: true })).toBeVisible();
    await expect(page.getByText("Varighed", { exact: true })).toBeHidden();
    // A trip's date takes two lines; the chart still fits.
    await expect(page.getByText("søndag 11. oktober").first()).toBeVisible();
    const { y, height } = await boxOf(chart(page));
    expect(y + height, "the chart's bottom edge is on the first screen").toBeLessThanOrEqual(800);
  });
});

test("a phone opens Flere indstillinger and goes back", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phones only");
  await page.goto("/");
  await page.getByRole("link", { name: "Flere indstillinger" }).click();
  await expect(page).toHaveURL(/\?settings$/);
  await expect(page.getByRole("heading", { name: "Flere indstillinger" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Deltagere" })).toBeVisible();

  await page.locator("header").getByRole("link", { name: "Planlæg" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Flere indstillinger" })).toBeHidden();
});

/** Picks `label` on the wheel a settings button opens, and checks it took. */
async function pickOnWheel(page: Page, current: string, label: string) {
  const trigger = page
    .getByRole("button", { name: current, exact: true })
    .filter({ visible: true });
  await trigger.click();
  await page.getByText(label, { exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByRole("button", { name: label, exact: true }).first()).toBeVisible();
  await page.keyboard.press("Escape");
}

test("a suggestion carries its place, note, deadline and number of dates", async ({
  page,
  backend,
  isMobile,
}) => {
  await page.goto("/");
  await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
  if (isMobile) {
    await page.getByRole("link", { name: "Flere indstillinger" }).click();
  } else {
    await page.getByRole("tab", { name: "Sted og note" }).click();
  }
  await page.getByRole("textbox", { name: "Sted" }).fill("Hos Sara");
  await page.getByRole("textbox", { name: "Note" }).fill("Tag snacks med");
  if (!isMobile) await page.getByRole("tab", { name: "Afstemning" }).click();
  await pickOnWheel(page, "3 dage", "5 dage");
  await pickOnWheel(page, "Op til 5", "Op til 3");
  if (isMobile) await page.locator("header").getByRole("link", { name: "Planlæg" }).click();

  await page.getByRole("button", { name: /^Foreslå( datoer)?$/ }).click();
  await expect.poll(() => backend.calls.find((c) => c.body.action === "suggest")).toBeTruthy();
  const sent = backend.calls.find((c) => c.body.action === "suggest")!.body;
  expect(sent).toMatchObject({ place: "Hos Sara", note: "Tag snacks med", answerDays: 5 });
  expect((sent.dates as unknown[]).length).toBeLessThanOrEqual(3);
});
