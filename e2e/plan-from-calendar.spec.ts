/** Planning from My calendar on a phone (#126): the Planlæg sheet, the paper pile, the dates sent. */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "phones only"));

/** Planlæg starts with a random group; a test that needs one picks it. */
async function pickGroup(page: Page, name: string) {
  const sheet = page.getByRole("dialog", { name: "Planlæg" });
  await sheet.getByRole("button", { name: /^Gruppe/ }).click();
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
  await expect(sheet.getByRole("button", { name: /^Gruppe/ })).toContainText(name);
}

test("Planlæg opens over the calendar, and the dates found are sent as they were shown", async ({
  page,
  backend,
}) => {
  await page.goto("/calendar-overview");
  await page.getByRole("button", { name: "Planlæg" }).click();
  await expect(page).toHaveURL(/\?plan$/);
  const sheet = page.getByRole("dialog", { name: "Planlæg" });
  await pickGroup(page, "Løbeklubben");

  // Reduced motion (as every test runs): straight to the dates, no pile.
  await sheet.getByRole("button", { name: "Find dato" }).click();
  await expect(page.getByText("De 5 bedste datoer")).toBeVisible();
  // A date opens to what Casy really checked about it.
  await page
    .getByRole("button", { name: /^Detaljer om/ })
    .first()
    .click();
  await expect(page.getByText(/^Alle \d kan$/).first()).toBeVisible();
  await expect(page.getByText("Med i forslaget").first()).toBeVisible();
  await page.getByRole("button", { name: "Foreslå top 5 datoer" }).click();

  await expect.poll(() => backend.calls.find((c) => c.body.action === "suggest")).toBeTruthy();
  const sent = backend.calls.find((c) => c.body.action === "suggest")!.body;
  const dates = sent.dates as { start: string; answer: string }[];
  expect(dates).toHaveLength(5);
  // Your calendar is free on every one: sent as yours too, changeable on My events.
  expect(dates.every((d) => d.answer === "accepted")).toBe(true);
  // Sent, the plan closes onto the home page; the vote waits under Aftaler (#169).
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Aftaler", exact: true })).toBeVisible();
});

test("a new group made from the plan is invited to, then picked for the plan (#153)", async ({
  page,
}) => {
  await page.goto("/calendar-overview?plan");
  const plan = page.getByRole("dialog", { name: "Planlæg" });
  await plan.getByRole("button", { name: /^Gruppe/ }).click();
  await page.getByRole("button", { name: /^Ny gruppe/ }).click();
  await page.getByLabel("Gruppenavn").fill("Fredagsfilm");
  await page.getByRole("button", { name: "Næste" }).click();
  const invite = page.getByRole("dialog", { name: "Invitér til Fredagsfilm" });
  await invite.getByRole("button", { name: "Færdig" }).click();
  await expect(invite).toHaveCount(0);
  // Still planning, now for the new group.
  await expect(plan.getByRole("button", { name: /^Gruppe/ })).toContainText("Fredagsfilm");
});

test("back closes the sheet, and Ret planen goes from the dates back to it", async ({ page }) => {
  await page.goto("/calendar-overview");
  await page.getByRole("button", { name: "Planlæg" }).click();
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Planlæg" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("button", { name: "Planlæg" }).click();
  await page.getByRole("button", { name: "Find dato" }).click();
  await page.getByRole("button", { name: "Ret planen" }).click();
  await expect(page.getByRole("dialog", { name: "Planlæg" })).toBeVisible();
});

test("Planlæg med AI takes over the sheet, then hands the settings back filled in", async ({
  page,
}) => {
  await page.goto("/calendar-overview");
  await page.getByRole("button", { name: "Planlæg" }).click();
  const sheet = page.getByRole("dialog", { name: "Planlæg" });
  // Its members are who the names in the text are matched against.
  await pickGroup(page, "Løbeklubben");
  // By hand first; the AI is one button above.
  await expect(sheet.getByRole("textbox", { name: /Hvad skal I/i })).toBeVisible();
  await sheet.getByRole("button", { name: "Planlæg med AI" }).click();
  await expect(sheet.getByRole("textbox", { name: /Hvad skal I/i })).toBeHidden();
  await expect(sheet.getByRole("button", { name: "Find dato" })).toBeHidden();

  await sheet
    .getByRole("textbox", { name: /Fx middag en fredag/ })
    .fill("Middag en fredag i november uden Jonas og Peter");
  await sheet.getByRole("button", { name: "Lav planen" }).click();
  await sheet.getByRole("button", { name: "Kl. 18", exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await sheet.getByRole("button", { name: "Ingen af dem", exact: true }).first().click();
  }

  // Every question answered: the settings come back with Casy's answer in
  // them, and the AI only starts over from here.
  await expect(sheet.getByRole("textbox", { name: /Hvad skal I/i })).toHaveValue("Middag");
  await expect(sheet.getByRole("button", { name: "Beskriv på ny" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Tilføj detaljer" })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Find dato" })).toBeVisible();
});

test("the sheet's rows: give or take an hour, and the details folded away go along (#173)", async ({
  page,
  backend,
}) => {
  await page.goto("/calendar-overview?plan");
  const sheet = page.getByRole("dialog", { name: "Planlæg" });
  // Two half hours either way: ± 1 t.
  await sheet.getByRole("button", { name: "Mere fleksibel" }).click();
  await sheet.getByRole("button", { name: "Mere fleksibel" }).click();
  await expect(sheet.getByText("1 t", { exact: true })).toBeVisible();

  await sheet.getByRole("button", { name: "Flere detaljer" }).click();
  await sheet.getByRole("button", { name: /^Deltagere/ }).click();
  await expect(page.getByRole("dialog", { name: "Deltagere" })).toBeVisible();
  await page
    .getByRole("dialog", { name: "Deltagere" })
    .getByRole("button", { name: "Færdig" })
    .click();
  await sheet.getByRole("textbox", { name: "Sted" }).fill("Hos Sara");
  await sheet.getByRole("textbox", { name: "Note" }).fill("Tag snacks med");
  await sheet.getByRole("button", { name: "Find dato" }).click();
  await page.getByRole("button", { name: "Foreslå top 5 datoer" }).click();

  await expect.poll(() => backend.calls.find((c) => c.body.action === "suggest")).toBeTruthy();
  const sent = backend.calls.find((c) => c.body.action === "suggest")!.body;
  expect(sent).toMatchObject({ place: "Hos Sara", note: "Tag snacks med" });
  // The start may move an hour either way of the hour picked, the length kept.
  const settings = sent.settings as {
    startHour: number;
    startWindow: { from: number; to: number };
  };
  expect(settings.startWindow).toEqual({
    from: Math.max(0, settings.startHour * 60 - 60),
    to: Math.min(23 * 60 + 30, settings.startHour * 60 + 60),
  });
});

/** Describes a plan that finds no date (weekday mornings in October), and looks for it. */
async function planNothing(page: import("@playwright/test").Page) {
  await page.goto("/calendar-overview");
  await page.getByRole("button", { name: "Planlæg" }).click();
  const sheet = page.getByRole("dialog", { name: "Planlæg" });
  await sheet.getByRole("button", { name: "Planlæg med AI" }).click();
  await sheet
    .getByRole("textbox", { name: /Fx middag en fredag/ })
    .fill("møde om formiddagen på hverdage i oktober");
  await sheet.getByRole("button", { name: "Lav planen" }).click();
  await sheet.getByRole("button", { name: "Find dato" }).click();
}

test("with no date, a way to widen the search finds one and lists its dates (#135)", async ({
  page,
}) => {
  await planNothing(page);
  const widen = page.getByRole("region", { name: "Ingen dato passer. Det her ville virke:" });
  await expect(widen).toBeVisible();
  await widen.getByRole("button").first().click();
  await expect(widen).toBeHidden();
  await expect(page.getByRole("button", { name: /^Foreslå/ })).toBeEnabled();
});

test("without AI switched on, the sheet offers no planning with AI (#111)", async ({
  page,
  backend,
}) => {
  backend.world.aiAllowed = false;
  await page.goto("/calendar-overview?plan");
  await expect(page.getByRole("button", { name: "Find dato" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Planlæg med AI" })).toHaveCount(0);
});

test.describe("signed out", () => {
  test.use({ signedIn: false });

  test("the scheduler's address leads a phone to sign in, not to a scheduler (#127)", async ({
    page,
  }) => {
    await page.goto("/plan");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the calendars pile up, and the dates come only once they have all been through", async ({
    page,
  }) => {
    await page.goto("/calendar-overview");
    await page.getByRole("button", { name: "Planlæg" }).click();
    await page.getByRole("button", { name: "Find dato" }).click();
    // No way past it, and nothing to send until the pile is done.
    await page.waitForTimeout(1500);
    await expect(page.getByRole("button", { name: "Foreslå top 5 datoer" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Foreslå top 5 datoer" })).toBeEnabled({
      timeout: 25_000,
    });
    await expect(page.getByText("De 5 bedste datoer")).toBeVisible();
  });

  test("a way to widen the search lifts its dates into the list, the pile not thrown again (#135)", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await planNothing(page);
    const widen = page.getByRole("region", { name: "Ingen dato passer. Det her ville virke:" });
    await expect(widen).toBeVisible({ timeout: 25_000 });
    await widen.getByRole("button").first().click();
    // The dates are lifted into the list and checked again (the way on waits
    // until they are), with no layers thrown.
    await expect(page.getByRole("button", { name: "Ret planen" })).toBeHidden();
    await expect(page.locator("[data-pile]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Foreslå/ })).toBeEnabled({ timeout: 15_000 });
  });

  test("sent, the dates not offered swipe away and the five fly into Aftaler, which hops (#102, #169)", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/calendar-overview");
    await page.getByRole("button", { name: "Planlæg" }).click();
    await page.getByRole("button", { name: "Find dato" }).click();
    const send = page.getByRole("button", { name: "Foreslå top 5 datoer" });
    await expect(send).toBeEnabled({ timeout: 25_000 });
    await expect(page.locator('[data-send-row="yes"]')).toHaveCount(5);
    const rows = await page.locator("[data-send-row]").count();

    await send.click();
    // Copies of every row move over the page, into the home page's Aftaler
    // button, back for the flight; the plan stays open until they have arrived.
    const flight = page.locator("[data-send-flight]");
    await expect(flight).toBeAttached();
    expect(await flight.locator("> *").count()).toBe(rows);
    const aftaler = page.getByRole("button", { name: "Aftaler", exact: true });
    await expect(aftaler).toBeVisible();
    await expect(page).toHaveURL(/\?plan$/);
    // It hops as each date lands.
    await expect
      // Often, so as not to step over the hops (about a second in all).
      .poll(() => aftaler.evaluate((el) => el.getAnimations().length), {
        timeout: 10_000,
        intervals: [50],
      })
      .toBeGreaterThan(0);

    // Then the plan closes onto the home page.
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
    await expect(page.locator("[data-send-flight]")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(aftaler).toBeVisible();
  });
});
