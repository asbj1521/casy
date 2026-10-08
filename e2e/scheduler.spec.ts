/**
 * The scheduling page: the answer for a real group, "Suggest dates" sending
 * it with the other good dates as a vote, and the layout (#98): on a wide
 * screen the answer and the settings side by side, as tall as each other,
 * with the chart still on the first screen of a laptop; on a phone a flow
 * of four steps (#101).
 */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { cph } from "./world";

/** The button that sends the dates: on a computer, and in the phone's flow (#101). */
const SEND = /^(Foreslå( datoer)?|Send datoer til afstemning)$/;

/** On a phone, from the flow's second or third step on to its dates. */
async function onToDates(page: Page) {
  if (/step=what/.test(page.url())) {
    await page.getByRole("button", { name: "Næste", exact: true }).click();
  }
  await page.getByRole("button", { name: /^(Spring over|Se datoer)$/ }).click();
  await expect(page).toHaveURL(/\?step=dates$/);
}

test("suggesting sends the date on screen as a vote", async ({ page, backend, isMobile }) => {
  await page.goto(isMobile ? "/?step=what" : "/");
  await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
  await page.getByRole("textbox", { name: /Hvad skal I/i }).fill("Fredagsbar");
  if (isMobile) await onToDates(page);
  await page.getByRole("button", { name: SEND }).click();

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
      ["Deltagere", false],
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

test.describe("on a phone (#101)", () => {
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, "phones only"));

  test("planning goes step by step, from the group to the dates", async ({ page, backend }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Hvem skal med?" })).toBeVisible();
    await expect(page.getByText("Trin 1 af 4")).toBeVisible();

    // A tap on a group picks it; Næste moves on.
    await page.getByRole("button", { name: /Løbeklubben/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("button", { name: "Næste", exact: true }).click();
    await expect(page).toHaveURL(/\?step=what$/);
    await expect(page.getByRole("heading", { name: "Hvad og hvornår" })).toBeVisible();
    // The first date, live, above the button.
    await expect(page.getByRole("button", { name: /Første dato/ })).toBeVisible();

    await page.getByRole("button", { name: "Næste", exact: true }).click();
    await expect(page).toHaveURL(/\?step=details$/);
    // Optional: Spring over until something is set, then Se datoer.
    await expect(page.getByRole("button", { name: "Spring over" })).toBeVisible();
    await page.getByRole("textbox", { name: "Sted" }).fill("Hos Sara");
    await expect(page.getByRole("button", { name: "Se datoer" })).toBeVisible();

    // Back a step and on again: what was set stays.
    await page.locator("header").getByRole("link", { name: "Hvad og hvornår" }).click();
    await expect(page).toHaveURL(/\?step=what$/);
    await page.getByRole("button", { name: "Næste", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Sted" })).toHaveValue("Hos Sara");

    await page.getByRole("button", { name: "Se datoer" }).click();
    await expect(page).toHaveURL(/\?step=dates$/);
    // The dates that go into the vote, listed before they are sent.
    await expect(page.getByText("Også i afstemningen")).toBeVisible();

    await page.getByRole("button", { name: SEND }).click();
    await expect.poll(() => backend.calls.find((c) => c.body.action === "suggest")).toBeTruthy();
    expect(backend.calls.find((c) => c.body.action === "suggest")!.body).toMatchObject({
      groupId: "g-running",
      place: "Hos Sara",
    });
  });

  test("the phone's back button goes a step back", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Fredagsbar/ }).click();
    await page.getByRole("button", { name: "Næste", exact: true }).click();
    await page.getByRole("button", { name: "Næste", exact: true }).click();
    await expect(page).toHaveURL(/\?step=details$/);
    await page.goBack();
    await expect(page).toHaveURL(/\?step=what$/);
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Hvem skal med?" })).toBeVisible();
  });

  test("Deltagere opens a sheet, and its row sums up the choice", async ({ page, backend }) => {
    await page.goto("/?step=details");
    await expect(page.getByRole("button", { name: /Deltagere.*Alle 4/ })).toBeVisible();
    await page.getByRole("button", { name: /Deltagere/ }).click();
    const sheet = page.getByRole("dialog", { name: "Deltagere" });
    await sheet
      .getByRole("radiogroup", { name: "Sara" })
      .getByRole("radio", { name: "Valgfri" })
      .click();
    // You are always invited.
    await expect(
      sheet.getByRole("radiogroup", { name: "Dig" }).getByRole("radio", { name: "Ikke med" }),
    ).toBeDisabled();
    await sheet.getByRole("button", { name: "Færdig" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("button", { name: /3 med, 1 valgfri/ })).toBeVisible();

    await onToDates(page);
    await page.getByRole("button", { name: SEND }).click();
    await expect.poll(() => backend.calls.find((c) => c.body.action === "suggest")).toBeTruthy();
    expect(backend.calls.find((c) => c.body.action === "suggest")!.body.settings).toMatchObject({
      people: { optional: ["p-sara"] },
    });
  });

  test("the live answer opens the dates", async ({ page }) => {
    await page.goto("/?step=what");
    await page.getByRole("button", { name: /Første dato/ }).click();
    await expect(page).toHaveURL(/\?step=dates$/);
  });
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
  await page.goto(isMobile ? "/?step=details" : "/");
  await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
  if (!isMobile) await page.getByRole("tab", { name: "Sted og note" }).click();
  await page.getByRole("textbox", { name: "Sted" }).fill("Hos Sara");
  await page.getByRole("textbox", { name: "Note" }).fill("Tag snacks med");
  // On a phone, the vote's settings are on the dates step, beside the dates.
  if (isMobile) await onToDates(page);
  else await page.getByRole("tab", { name: "Afstemning" }).click();
  await pickOnWheel(page, "3 dage", "5 dage");
  await pickOnWheel(page, "Op til 5", "Op til 3");

  await page.getByRole("button", { name: SEND }).click();
  await expect.poll(() => backend.calls.find((c) => c.body.action === "suggest")).toBeTruthy();
  const sent = backend.calls.find((c) => c.body.action === "suggest")!.body;
  expect(sent).toMatchObject({ place: "Hos Sara", note: "Tag snacks med", answerDays: 5 });
  expect((sent.dates as unknown[]).length).toBeLessThanOrEqual(3);
});

test.describe("who an event is for (#89)", () => {
  test.use({ viewport: { width: 1440, height: 800 } });
  test.beforeEach(({ isMobile }) => test.skip(isMobile, "the phone has the same part"));

  test("at least N changes the answer, and travels with the suggestion", async ({
    page,
    backend,
  }) => {
    await page.goto("/");
    await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
    await page.getByRole("tab", { name: "Deltagere" }).click();
    await page.getByRole("radio", { name: "Mindst" }).click();
    // Four in the group: at least 3 of 4 to start with.
    await expect(page.getByText("3 af 4")).toBeVisible();
    await expect(page.getByText("Første dato hvor mindst 3 kan")).toBeVisible();

    await page.getByRole("button", { name: SEND }).click();
    await expect.poll(() => backend.calls.find((c) => c.body.action === "suggest")).toBeTruthy();
    const settings = backend.calls.find((c) => c.body.action === "suggest")!.body.settings;
    expect(settings).toMatchObject({
      people: { members: ["p-mia", "p-jonas", "p-sara", "p-emil"], optional: [], atLeast: 3 },
    });
  });

  test("optional and left-out members are sent as such, and the chart still fits", async ({
    page,
    backend,
  }) => {
    await page.goto("/");
    await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
    await page.getByRole("tab", { name: "Deltagere" }).click();
    // Sara: Med to Valgfri. Jonas: Med to Valgfri to Ikke med.
    await page.getByRole("button", { name: /^Sara: Med/ }).click();
    await page.getByRole("button", { name: /^Jonas: Med/ }).click();
    await page.getByRole("button", { name: /^Jonas: Valgfri/ }).click();
    await expect(page.getByRole("button", { name: /^Jonas: Ikke med/ })).toBeVisible();
    // You can't leave yourself out: yours goes back to Med.
    await page.getByRole("button", { name: /^Dig: Med/ }).click();
    await page.getByRole("button", { name: /^Dig: Valgfri/ }).click();
    await expect(page.getByRole("button", { name: /^Dig: Med/ })).toBeVisible();

    const { y, height } = (await chart(page).boundingBox())!;
    expect(y + height).toBeLessThanOrEqual(800);

    await page.getByRole("button", { name: SEND }).click();
    await expect.poll(() => backend.calls.find((c) => c.body.action === "suggest")).toBeTruthy();
    expect(backend.calls.find((c) => c.body.action === "suggest")!.body.settings).toMatchObject({
      people: { members: ["p-mia", "p-sara", "p-emil"], optional: ["p-sara"] },
    });
  });
});
