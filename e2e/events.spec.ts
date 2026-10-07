/**
 * My events: answering a date, leaving, a suggester's choice, and a vote's
 * dates answered with buttons, keys (a computer) or a swipe (a phone).
 */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

/** A section of My events' list, by its heading. */
const section = (page: Page, name: string) =>
  page
    .locator("section, div")
    .filter({ has: page.getByText(name, { exact: true }) })
    .last();

test("accepting a date moves the event on to waiting for others", async ({
  page,
  backend,
  isMobile,
}) => {
  await page.goto(isMobile ? "/events" : "/events/ev-dinner");
  const card = isMobile
    ? page.locator("article, li, div").filter({ hasText: "Middag hos Sara" }).last()
    : page;
  await card.getByRole("button", { name: "Accepter" }).first().click();

  await expect.poll(() => backend.calls.some((c) => c.body.action === "respond")).toBe(true);
  expect(backend.calls.find((c) => c.body.action === "respond")?.body).toMatchObject({
    proposalId: "ev-dinner",
    response: "accepted",
  });
  if (!isMobile) await expect(page).toHaveURL(/\/events\/ev-dinner$/);
  await expect(page.getByRole("button", { name: "Accepter" })).toHaveCount(0);
});

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

test("the suggester can choose a vote's date", async ({ page, backend, isMobile }) => {
  test.skip(isMobile, "choosing on a phone is the same buttons on the card");
  await page.goto("/events/ev-cinema");
  await page.getByRole("button", { name: "Vælg" }).first().click();
  await expect
    .poll(() => backend.calls.find((c) => c.body.action === "choose")?.body)
    .toMatchObject({
      proposalId: "ev-cinema",
      dateId: "d-cin-1",
    });
  await expect(page.getByText("Planlagt").first()).toBeVisible();
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

test("a phone swipes through a vote's dates", async ({ page, backend, isMobile }) => {
  test.skip(!isMobile, "phones only");
  await page.goto("/events");
  await page.getByRole("link", { name: "Svar på datoerne" }).click();
  await expect(page).toHaveURL(/\/events\/ev-boardgames\/dates$/);

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
