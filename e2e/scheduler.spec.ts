/**
 * The scheduling page: the answer for a real group, "Suggest dates" sending
 * it with the other good dates as a vote, and the layout (#98): on a wide
 * screen the answer and the settings side by side, as tall as each other,
 * with the chart still on the first screen of a laptop. Computers only: a
 * phone plans from My calendar (#127, plan-from-calendar.spec.ts).
 */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { cph } from "./world";

test.beforeEach(({ isMobile }) => test.skip(isMobile, "a phone plans from My calendar (#127)"));

/** The button that sends the dates. */
const SEND = /^Foreslå( datoer)?$/;

test("suggesting sends the date on screen as a vote", async ({ page, backend }) => {
  await page.goto("/");
  await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
  await page.getByRole("textbox", { name: /Hvad skal I/i }).fill("Fredagsbar");
  await page.getByRole("button", { name: SEND }).click();

  await expect.poll(() => backend.calls.find((c) => c.body.action === "suggest")).toBeTruthy();
  const sent = backend.calls.find((c) => c.body.action === "suggest")!.body;
  expect(sent).toMatchObject({ groupId: "g-friday", title: "Fredagsbar" });
  const dates = sent.dates as { start: string }[];
  expect(dates[0].start).toBe(cph("2026-10-07", "17:00"));
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
  // A CSS lookup, which finds the tab list even while the AI view covers it.
  page.locator("section").filter({ has: page.locator('[role="tablist"]') });
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
    // The box is as tall as the answer beside it: measured once the answer is in.
    await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
    const before = (await boxOf(settingsBox(page))).height;
    for (const tab of ["Deltagere", "Sted og note", "Afstemning"]) {
      await page.getByRole("tab", { name: tab }).click();
      await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
      expect((await boxOf(settingsBox(page))).height).toBe(before);
    }
    await page.getByRole("tab", { name: "Tidspunkt" }).click();
    await expect(page.getByRole("radio", { name: "Møde" })).toBeVisible();
  });

  test("planning with AI (#100) fills the settings beside the answer, the chart still in view", async ({
    page,
    backend,
  }) => {
    await page.goto("/");
    await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
    const before = (await boxOf(settingsBox(page))).height;
    await page.getByRole("button", { name: "Planlæg med AI" }).click();
    // The AI takes the whole box, which keeps its height.
    await expect(page.getByRole("heading", { name: "Planlæg med AI" })).toBeVisible();
    await expect(page.getByRole("tablist")).toBeHidden();
    expect((await boxOf(settingsBox(page))).height).toBe(before);
    await page
      .getByRole("textbox", { name: /Fx middag en fredag/ })
      .fill("Middag en fredag i november uden Jonas");
    // Enter sends, as in any chat.
    await page.getByRole("textbox", { name: /Fx middag en fredag/ }).press("Enter");

    await expect(page.getByText("Hvornår på aftenen?")).toBeVisible();
    // What it picked up, as settings rather than the words: the time marked as a guess.
    const summary = page.locator("dl").filter({ hasText: "Tidspunkt" });
    await expect(summary).toContainText("Middag");
    await expect(summary).toContainText("18:00 til 21:00 (3 t)");
    await expect(summary).toContainText("Fredag");
    await expect(summary).toContainText("I november");
    await expect(summary).toContainText("3 med, uden Jonas");
    await expect(summary.getByText("gættet")).toHaveCount(1);
    // The words themselves are folded away.
    await expect(page.getByText("Det du skrev")).toBeVisible();
    await expect(page.getByText("Middag en fredag i november uden Jonas")).toBeHidden();
    // The answer beside it follows: a Friday in November.
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/fredag.*november/i);
    // As tall as the answer beside it, however long the conversation gets.
    const answer = await boxOf(answerBox(page));
    expect(Math.abs((await boxOf(settingsBox(page))).height - answer.height)).toBeLessThanOrEqual(
      1,
    );
    const { y, height } = await boxOf(chart(page));
    expect(y + height, "the chart's bottom edge is on the first screen").toBeLessThanOrEqual(800);

    // The settings it filled, its guess marked, one click away.
    await page.getByRole("button", { name: "Indstillinger", exact: true }).click();
    await expect(page.getByRole("textbox", { name: /Hvad skal I/i })).toHaveValue("Middag");
    await expect(page.getByRole("tab", { name: "Tidspunkt" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByText("gættet", { exact: true }).filter({ visible: true })).toHaveCount(
      1,
    );
    expect(backend.calls.filter((c) => c.name === "plan-ai")).toHaveLength(1);
  });

  test("once its questions are answered, what Casy picked up fits beside the answer", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
    await page.getByRole("button", { name: "Planlæg med AI" }).click();
    const text = page.getByRole("textbox", { name: /Fx middag en fredag/ });
    await text.fill("Middag en fredag i november uden Jonas");
    await text.press("Enter");
    await page.getByRole("button", { name: "Kl. 18" }).click();
    await page.getByRole("button", { name: "Ingen af dem" }).click();
    // Answered, a question folds to one line (still there to change).
    await expect(page.getByRole("button", { name: "Jonas", exact: true })).toBeHidden();
    // Six rows of settings, none open: the AI's panel ends with the answer
    // beside it rather than growing over the chart (a guess is a sparkle in
    // the line, never a pill that wraps onto a line of its own).
    const panel = await boxOf(page.getByRole("dialog", { name: "Planlæg med AI" }));
    const answer = await boxOf(answerBox(page));
    expect(panel.y + panel.height).toBeLessThanOrEqual(answer.y + answer.height + 1);
  });

  test("a question with long options fits beside the answer, the chart left as it is", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
    await page.getByRole("button", { name: "Planlæg med AI" }).click();
    const text = page.getByRole("textbox", { name: /Fx middag en fredag/ });
    await text.fill("te hos mormor og morfar");
    await text.press("Enter");
    await expect(page.getByRole("button", { name: "En hyggeaften" })).toBeVisible();
    // "Tilføj detaljer" and "Beskriv på ny" share the box's top row (#124).
    await expect(page.getByRole("button", { name: "Tilføj detaljer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Beskriv på ny" })).toBeVisible();
    const panel = await boxOf(page.getByRole("dialog", { name: "Planlæg med AI" }));
    const answer = await boxOf(answerBox(page));
    expect(panel.y + panel.height).toBeLessThanOrEqual(answer.y + answer.height + 1);
    await expect(chart(page).locator("..")).not.toHaveAttribute("inert");
  });

  test("when it needs more room, the panel reaches over a faded chart", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
    await page.getByRole("button", { name: "Planlæg med AI" }).click();
    const text = page.getByRole("textbox", { name: /Fx middag en fredag/ });
    await text.fill("mange spørgsmål");
    await text.press("Enter");
    await expect(page.getByText("Hvornår ellers?")).toBeVisible();
    // Faded and out of reach while the panel is over it, back when it closes.
    await expect(chart(page).locator("..")).toHaveAttribute("inert");
    await page.getByRole("button", { name: "Indstillinger" }).click();
    await expect(chart(page).locator("..")).not.toHaveAttribute("inert");
  });

  test("with no date, the ways to widen the search that would find one are offered (#135)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
    await page.getByRole("button", { name: "Planlæg med AI" }).click();
    const text = page.getByRole("textbox", { name: /Fx middag en fredag/ });
    await text.fill("møde om formiddagen på hverdage i oktober");
    await text.press("Enter");
    const widen = page.getByRole("region", { name: "Ingen dato passer. Det her ville virke:" });
    await expect(widen).toBeVisible();
    // Only ways that find a date, each with it: never one leading to nothing.
    const options = widen.getByRole("button");
    expect(await options.count()).toBeGreaterThan(0);
    await expect(options.first()).toContainText(/\d{2}:\d{2}/);
    await options.first().click();
    await expect(widen).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/oktober/i);
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

/** Picks `label` on the wheel a settings button opens, and checks it took. */
async function pickOnWheel(page: Page, current: string, label: string) {
  const trigger = page
    .getByRole("button", { name: current, exact: true })
    .filter({ visible: true });
  await trigger.click();
  // The wheel repeats its options 15 times and opens on the middle repeat
  // (WheelPicker). Click the copy there, beside the current value: the first
  // copy is far above, and scrolling to it makes the wheel recentre itself,
  // which on a busy machine can take the click away.
  await page.getByText(label, { exact: true }).filter({ visible: true }).nth(7).click();
  await expect(page.getByRole("button", { name: label, exact: true }).first()).toBeVisible();
  await page.keyboard.press("Escape");
}

test("a suggestion carries its place, note, deadline and number of dates", async ({
  page,
  backend,
}) => {
  await page.goto("/");
  await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
  await page.getByRole("tab", { name: "Sted og note" }).click();
  await page.getByRole("textbox", { name: "Sted" }).fill("Hos Sara");
  await page.getByRole("textbox", { name: "Note" }).fill("Tag snacks med");
  await page.getByRole("tab", { name: "Afstemning" }).click();
  await pickOnWheel(page, "3 dage", "5 dage");
  await pickOnWheel(page, "Op til 5", "Op til 3");

  await page.getByRole("button", { name: SEND }).click();
  await expect.poll(() => backend.calls.find((c) => c.body.action === "suggest")).toBeTruthy();
  const sent = backend.calls.find((c) => c.body.action === "suggest")!.body;
  expect(sent).toMatchObject({ place: "Hos Sara", note: "Tag snacks med", answerDays: 5 });
  expect((sent.dates as unknown[]).length).toBeLessThanOrEqual(3);
  // What the event is likely to cause (#113) goes with it, asked from what was typed.
  expect(sent.impact).toMatchObject({ effects: ["alcohol"], runsLate: true });
  const asked = backend.calls.filter((c) => c.name === "event-profile").at(-1)?.body;
  expect(asked).toMatchObject({ event: { place: "Hos Sara", note: "Tag snacks med" } });
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

test("without AI switched on, the scheduler offers no planning with AI (#111)", async ({
  page,
  backend,
}) => {
  backend.world.aiAllowed = false;
  await page.goto("/");
  await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Planlæg med AI" })).toHaveCount(0);
  expect(backend.calls.some((c) => c.name === "calendar-categorize" || c.name === "plan-ai")).toBe(
    false,
  );
});
