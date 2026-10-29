/**
 * My events: leaving, a suggester's choice, and a vote's dates answered with
 * buttons, keys (a computer) or a swipe (a phone).
 */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

/** A section of My events' list, by its heading. */
const section = (page: Page, name: string) =>
  page
    .locator("section, div")
    .filter({ has: page.getByText(name, { exact: true }) })
    .last();

test("leaving asks first, then the event is gone", async ({ page, backend, isMobile }) => {
  test.skip(isMobile, "the phone's cards are covered by the screenshots");
  await page.goto("/events/ev-run");
  await page.getByRole("button", { name: "Forlad aftale" }).click();
  await expect(page.getByText("Forlad aftalen? Den fortsætter uden dig")).toBeVisible();
  expect(backend.calls.some((c) => c.body.action === "leave")).toBe(false);

  await page.getByRole("button", { name: "Forlad aftale" }).last().click();
  await expect(page.getByRole("link", { name: /Løbetur/ })).toHaveCount(0);
  // Back to the list, with the first event open beside it.
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.getByText("Foreslået af Jonas")).toBeVisible();
});

test("an event that isn't there goes back to the list", async ({ page, isMobile }) => {
  test.skip(isMobile, "a phone has no open event");
  await page.goto("/events/no-such-event");
  await expect(page).toHaveURL(/\/events(\/ev-boardgames)?$/);
  await expect(page.getByRole("heading", { name: "Mine aftaler" })).toBeVisible();
});

test.describe("a computer's open vote (#103)", () => {
  test.beforeEach(({ isMobile }) => test.skip(isMobile, "computers only"));

  test("your answers are a tick and a cross, and nobody chooses while it votes", async ({
    page,
    backend,
  }) => {
    await page.goto("/events/ev-cinema");
    await expect(page.getByRole("button", { name: /^Jeg kan ikke: / })).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Vælg" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ret dine svar" })).toHaveCount(0);

    const cross = page.getByRole("button", { name: /^Jeg kan ikke: fre\. 23\./ });
    await cross.click();
    await expect
      .poll(() => backend.calls.find((c) => c.body.action === "answer")?.body)
      .toMatchObject({ proposalId: "ev-cinema", dateId: "d-cin-2", response: "declined" });
    await expect(cross).toHaveAttribute("aria-pressed", "true");
  });

  test("the suggester chooses only when no date can win", async ({ page, backend }) => {
    // Everyone has answered, and both dates have a "can't".
    const cinema = backend.world.events.find((e) => e.id === "ev-cinema")!;
    const [first, second] = cinema.candidates;
    first.answers = { ...first.answers, [cinema.invitees[2].profileId]: "declined" };
    second.answers = {
      ...second.answers,
      [cinema.invitees[1].profileId]: "declined",
      [cinema.invitees[2].profileId]: "accepted",
    };

    await page.goto("/events/ev-cinema");
    await page.getByRole("button", { name: "Vælg" }).first().click();
    await expect
      .poll(() => backend.calls.find((c) => c.body.action === "choose")?.body)
      .toMatchObject({ proposalId: "ev-cinema", dateId: "d-cin-1" });
    await expect(page.getByText("Planlagt").first()).toBeVisible();
  });
});

test("an agreed vote's \"can't after all\" is asked first, then moves the date", async ({
  page,
  backend,
  isMobile,
}) => {
  test.skip(isMobile, "the phone's is in the screenshots");
  // Julefrokost, agreed, as a vote that was decided on its date.
  const party = backend.world.events.find((e) => e.id === "ev-party")!;
  const date = party.currentDate!;
  Object.assign(party, {
    mode: "vote",
    candidates: [{ ...date, answers: {}, chosenAt: party.updatedAt }],
  });

  await page.goto("/events/ev-party");
  await page.getByRole("button", { name: "Kan ikke alligevel" }).click();
  expect(backend.calls.some((c) => c.body.action === "answer")).toBe(false);
  await page.getByRole("button", { name: "Jeg kan ikke, find en ny" }).click();
  await expect
    .poll(() => backend.calls.find((c) => c.body.action === "answer")?.body)
    .toMatchObject({ proposalId: "ev-party", dateId: date.id, response: "declined" });
});

test("a computer answers a vote's dates with the arrow keys", async ({
  page,
  backend,
  isMobile,
}) => {
  test.skip(isMobile, "computers only");
  await page.goto("/events/ev-boardgames");
  await expect(page.getByText("Dato 1 af 3", { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Dato 2 af 3", { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByText("Dato 3 af 3", { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowLeft");

  await expect
    .poll(() => backend.calls.filter((c) => c.body.action === "answer").map((c) => c.body.response))
    .toEqual(["accepted", "maybe", "declined"]);
  // Emil hasn't answered yet, so the vote waits for him.
  await expect(section(page, "Venter på andre").getByText("Brætspilsaften")).toBeVisible();
});

test("a phone swipes through a vote's dates over the home page's day view", async ({
  page,
  backend,
  isMobile,
}) => {
  test.skip(!isMobile, "phones only");
  await page.goto("/events");
  // The vote's row goes straight to swiping (#103), over the day view now (#172, #176).
  await page.getByRole("button", { name: /Brætspilsaften/ }).click();
  await expect(page).toHaveURL(/\/\?vote=ev-boardgames$/);

  const answers = () => backend.calls.filter((c) => c.body.action === "answer");
  for (let i = 1; i <= 3; i++) {
    const card = page.getByText(`Dato ${i} af 3`, { exact: true });
    // Measured once it holds still: the card before may still be flying off,
    // and the new one can be swapped in between a check and a measurement.
    let box: { x: number; y: number; width: number } | null = null;
    await expect(async () => {
      box = await card.boundingBox();
      expect(box).not.toBeNull();
    }).toPass();
    const { x, y, width } = box!;
    await page.mouse.move(x + width / 2, y + 40);
    await page.mouse.down();
    await page.mouse.move(x + width / 2 + 120, y + 40, { steps: 8 });
    await page.mouse.move(x + width / 2 + 260, y + 40, { steps: 8 });
    await page.mouse.up();
    // Each swipe is saved before the next card is touched.
    await expect.poll(() => answers().length).toBe(i);
  }
  expect(answers().every((c) => c.body.response === "accepted")).toBe(true);
  // Thanks, then back to the month.
  await expect(page.getByText("Tak, du har svaret").first()).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Vis Oktober" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Brætspilsaften" })).toHaveCount(0);
});

test("everyone sees an event's place and note; only the suggester edits them", async ({
  page,
  backend,
  isMobile,
}) => {
  test.skip(isMobile, "the phone's cards show the same part");
  // Jonas suggested this one: Mia sees it, but can't change it.
  await page.goto("/events/ev-boardgames");
  await expect(page.getByText("Hos Jonas, Nørrebrogade 12").first()).toBeVisible();
  await expect(page.getByText("Tag dit yndlingsspil med").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Ret sted og note" })).toHaveCount(0);

  // Mia suggested this one.
  await page.goto("/events/ev-party");
  await expect(page.getByText("Mikkeller Bar")).toBeVisible();
  await page.getByRole("button", { name: "Ret sted og note" }).click();
  await page.getByRole("textbox", { name: "Sted" }).fill("Fermentoren");
  await page.getByRole("textbox", { name: "Note" }).fill("Bord til 4 er bestilt");
  await page.getByRole("button", { name: "Gem" }).click();

  await expect(page.getByText("Fermentoren")).toBeVisible();
  await expect(page.getByText("Bord til 4 er bestilt")).toBeVisible();
  expect(backend.calls.find((c) => c.body.action === "edit")?.body).toMatchObject({
    proposalId: "ev-party",
    place: "Fermentoren",
    note: "Bord til 4 er bestilt",
  });
});

test.describe("a phone's Aftaler (#103, #177)", () => {
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, "phones only"));

  test("rows in three groups: what needs you, what is to come soonest first, what is over", async ({
    page,
  }) => {
    await page.goto("/events");
    const sheet = page.getByRole("dialog", { name: "Mine aftaler" });
    const group = (title: string) =>
      sheet.locator("section").filter({ has: page.getByRole("heading", { name: title }) });
    await expect(group("Svar nu").locator("li")).toHaveCount(1);
    await expect(group("Svar nu")).toContainText("Brætspilsaften");
    const coming = group("Kommende").locator("li");
    await expect(coming.first()).toContainText("Løbetur");
    await expect(coming.last()).toContainText("Julefrokost");
    await expect(group("Tidligere")).toContainText("Hyttetur");
    await expect(page.getByText("Aflyst", { exact: true })).toHaveCount(0);
  });

  test("a vote opens as a screen in the sheet, where a date's cross changes your answer", async ({
    page,
    backend,
  }) => {
    await page.goto("/events");
    await page.getByRole("button", { name: /Biograf/ }).click();
    await expect(page).toHaveURL(/\/\?events=ev-cinema$/);
    const sheet = page.getByRole("dialog", { name: "Biograf" });
    // Your answer on each date, a tick and a cross; nobody chooses while it votes.
    await expect(sheet.getByRole("button", { name: /^Jeg kan ikke: / })).toHaveCount(2);
    await expect(sheet.getByRole("button", { name: "Vælg" })).toHaveCount(0);
    // Freja hasn't answered: her face says so.
    await expect(
      sheet.getByRole("listitem", { name: "Freja: Har ikke svaret endnu" }),
    ).toBeVisible();

    const cross = sheet.getByRole("button", { name: /^Jeg kan ikke: fre\. 23\./ });
    await expect(cross).toHaveAttribute("aria-pressed", "false");
    await cross.click();
    await expect
      .poll(() => backend.calls.find((c) => c.body.action === "answer")?.body)
      .toMatchObject({ proposalId: "ev-cinema", dateId: "d-cin-2", response: "declined" });
    await expect(cross).toHaveAttribute("aria-pressed", "true");

    // "‹ Aftaler" back to the rows.
    await sheet.getByRole("button", { name: "Aftaler" }).click();
    await expect(page).toHaveURL(/\/\?events$/);
    await expect(page.getByRole("dialog", { name: "Mine aftaler" })).toBeVisible();
  });

  test("an agreed event's screen shows your day, which opens in the day view", async ({ page }) => {
    // An old link to one event leads to its screen in the sheet.
    await page.goto("/events/ev-party");
    await expect(page).toHaveURL(/\/\?events=ev-party$/);
    const sheet = page.getByRole("dialog", { name: "Julefrokost" });
    // The time beside its date (and again on the event in your day).
    await expect(sheet.getByText("18:00-23:00").first()).toBeVisible();
    await expect(
      sheet.getByRole("listitem", { name: /^Dig: Har sagt ja\. Du foreslog den$/ }),
    ).toBeVisible();
    await sheet.getByRole("button", { name: "Åbn dagen i din kalender" }).click();
    await expect(page).toHaveURL(/\/\?day=2026-11-28$/);
    await expect(page.getByRole("region", { name: "Lørdag 28. november" })).toBeVisible();
  });
});

test("an AI tester sees what Casy expects an event to involve (#113); nobody else does", async ({
  page,
  backend,
  isMobile,
}) => {
  test.skip(isMobile, "the phone shows the same part under the place and note");
  const run = backend.world.events.find((e) => e.id === "ev-run")!;
  run.impact = {
    v: 1,
    effects: ["exercise"],
    runsLate: false,
    strain: "moderate",
    recoveryDays: 0,
    outdoors: true,
    daylight: true,
    confidence: "high",
    reason: "En løbetur udenfor.",
  };
  await page.goto("/events/ev-run");
  await expect(page.getByText("Foreslået af Freja")).toBeVisible();
  await expect(page.getByRole("button", { name: "Casys vurdering" })).toHaveCount(0);

  // An AI tester who isn't an admin (the operator's test account).
  backend.world.aiTester = true;
  await page.reload();
  await page.getByRole("button", { name: "Casys vurdering" }).click();
  await expect(page.getByText("Lidt krævende · Sikker")).toBeVisible();
  await expect(page.getByText("Hård træning")).toBeVisible();
  await expect(page.getByText("Kræver dagslys")).toBeVisible();
  await expect(page.getByText("En løbetur udenfor.")).toBeVisible();
});
