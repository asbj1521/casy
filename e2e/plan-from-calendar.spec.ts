/** Planning from My calendar on a phone (#126): the Planlæg sheet, the paper pile, the dates sent. */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { PNG } from "./world";

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
  // No deadline unless one is chosen (#179): settled once everyone has answered.
  expect(sent.answerDays).toBeNull();
  // Your calendar is free on every one: sent as yours too, changeable on My events.
  expect(dates.every((d) => d.answer === "accepted")).toBe(true);
  // Sent, the plan closes onto the home page; the vote waits under Aftaler (#169).
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Aftaler", exact: true })).toBeVisible();
});

test("a deadline chosen under Flere detaljer goes with the dates (#179)", async ({
  page,
  backend,
}) => {
  await page.goto("/calendar-overview");
  await page.getByRole("button", { name: "Planlæg" }).click();
  const sheet = page.getByRole("dialog", { name: "Planlæg" });
  await pickGroup(page, "Løbeklubben");
  await sheet.getByRole("button", { name: "Flere detaljer" }).click();
  await sheet.getByRole("button", { name: /^Svarfrist/ }).click();
  await page
    .getByRole("dialog", { name: "Svarfrist" })
    .getByRole("radio", { name: "2 dage" })
    .click();
  await expect(sheet.getByRole("button", { name: /^Svarfrist/ })).toContainText("2 dage");

  await sheet.getByRole("button", { name: "Find dato" }).click();
  await page.getByRole("button", { name: "Foreslå top 5 datoer" }).click();
  await expect
    .poll(() => backend.calls.find((c) => c.body.action === "suggest")?.body)
    .toMatchObject({ answerDays: 2 });
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

test("✨ in the name field asks Casy, its questions drop from the field, and the sheet fills itself in (#173)", async ({
  page,
}) => {
  await page.goto("/calendar-overview");
  await page.getByRole("button", { name: "Planlæg" }).click();
  const sheet = page.getByRole("dialog", { name: "Planlæg" });
  // Its members are who the names in the text are matched against.
  await pickGroup(page, "Løbeklubben");
  const field = sheet.getByRole("textbox", { name: /Hvad skal I/i });
  // Nothing written, nothing to ask Casy about.
  await field.fill("");
  await expect(sheet.getByRole("button", { name: "Planlæg med AI" })).toHaveCount(0);

  await field.fill("Middag en fredag i november uden Jonas og Peter");
  await sheet.getByRole("button", { name: "Planlæg med AI" }).click();
  const questions = page.getByRole("dialog", { name: "Lige et spørgsmål" });
  await questions.getByRole("radio", { name: "Kl. 18" }).click();
  await questions.getByRole("radio", { name: "Ingen af dem" }).nth(0).click();
  await questions.getByRole("radio", { name: "Ingen af dem" }).nth(1).click();

  // The last answer closes the questions, and the sheet holds Casy's plan.
  await expect(questions).toHaveCount(0);
  await expect(field).toHaveValue("Middag");
  await expect(sheet.getByRole("button", { name: /^Dage/ })).toContainText("Fre");
  await expect(sheet.getByRole("button", { name: "Find dato" })).toBeEnabled();
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
  // It grows out of its row (#175), and Esc (or a tap outside) closes it, not the sheet.
  await expect(page.getByRole("dialog", { name: "Deltagere" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Deltagere" })).toHaveCount(0);
  await expect(sheet).toBeVisible();
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
  await sheet
    .getByRole("textbox", { name: /Hvad skal I/i })
    .fill("møde om formiddagen på hverdage i oktober");
  await sheet.getByRole("button", { name: "Planlæg med AI" }).click();
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

test.describe("Genveje (#175)", () => {
  /** A genvej as plan-presets keeps it: padel on weekdays, at the times given. */
  const padel = (times: { startHour: number }[]) => ({
    id: "00000000-0000-4000-8000-000000000001",
    name: "Padel",
    plan: {
      v: 1,
      settings: {
        multiDay: false,
        startHour: times[0].startHour,
        durationMinutes: 90,
        dows: [1, 2, 3, 4, 5],
        anyTime: false,
        startWindow: null,
        days: 3,
        startDow: 5,
      },
      times: times.map((t) => ({ ...t, startWindow: null, anyTime: false })),
      extras: { place: "Padelhallen", note: "", answerDays: null, dateCount: 5 },
    },
    updatedAt: "2026-10-07T08:00:00.000Z",
    pictureUrl: null as string | null,
  });

  test("a plan saved as a genvej is shown first, then run with the group chosen", async ({
    page,
    backend,
  }) => {
    await page.goto("/calendar-overview");
    await page.getByRole("button", { name: "Planlæg" }).click();
    const sheet = page.getByRole("dialog", { name: "Planlæg" });
    await pickGroup(page, "Løbeklubben");

    // Genveje shares the group's row; none yet, only plus squares.
    await sheet.getByRole("button", { name: "Genveje", exact: true }).click();
    const shortcuts = page.getByRole("dialog", { name: "Genveje" });
    await expect(shortcuts.getByRole("button", { name: "Ny genvej" })).toHaveCount(3);

    // A new one starts from the plan on screen, without a group or months;
    // it needs a name to be saved.
    await shortcuts.getByRole("button", { name: "Ny genvej" }).first().click();
    const editor = page.getByRole("dialog", { name: "Ny genvej" });
    await expect(editor.getByRole("button", { name: /^Gruppe/ })).toHaveCount(0);
    await expect(editor.getByText("Måneder")).toHaveCount(0);
    await expect(editor.getByRole("button", { name: "Gem genvej" })).toBeDisabled();
    await editor.getByRole("textbox", { name: /Navn på genvej/ }).fill("Padel");
    await editor.getByRole("button", { name: "Gem genvej" }).click();
    await expect(shortcuts.getByRole("button", { name: "Planlæg Padel" })).toBeVisible();
    // On screen at once; on the server a moment later.
    await expect.poll(() => backend.world.presets.length).toBe(1);
    expect(backend.world.presets).toMatchObject([{ name: "Padel", plan: { v: 1 } }]);
    expect(backend.world.presets[0]).not.toHaveProperty("groupId");
    expect(backend.world.presets[0].plan).not.toHaveProperty("settings.period");

    // A tap shows it big at the bottom with what it looks at; Find dato runs
    // it, with the group chosen in Planlæg.
    await shortcuts.getByRole("button", { name: "Planlæg Padel" }).click();
    const preview = shortcuts.getByRole("region", { name: "Padel" });
    await expect(preview).toContainText("Tid 1");
    await expect(preview).toContainText("17:00-19:00");
    // A tap on it puts it back; another shows it again.
    await preview.getByRole("button", { name: "Læg Padel tilbage" }).click();
    await expect(preview).toHaveCount(0);
    await shortcuts.getByRole("button", { name: "Planlæg Padel" }).click();
    await shortcuts.getByRole("button", { name: "Find dato" }).click();
    await expect(page.getByText("De 5 bedste datoer")).toBeVisible();
    await page.getByRole("button", { name: "Foreslå top 5 datoer" }).click();
    await expect
      .poll(() => backend.calls.find((c) => c.body.action === "suggest")?.body)
      .toMatchObject({ title: "Padel", groupId: "g-running" });
  });

  test("a genvej looks at up to three times, added and taken away again", async ({
    page,
    backend,
  }) => {
    backend.world.presets.push(padel([{ startHour: 7 }]));
    await page.goto("/calendar-overview");
    await page.getByRole("button", { name: "Planlæg" }).click();
    await page
      .getByRole("dialog", { name: "Planlæg" })
      .getByRole("button", { name: "Genveje", exact: true })
      .click();
    const shortcuts = page.getByRole("dialog", { name: "Genveje" });
    // One, and the row filled with two plus squares; its square says its name only.
    await expect(shortcuts.getByRole("button", { name: "Ny genvej" })).toHaveCount(2);
    await expect(shortcuts.getByRole("button", { name: "Planlæg Padel" })).toHaveText("Padel");

    await shortcuts.getByRole("button", { name: "Ret Padel" }).click();
    const editor = page.getByRole("dialog", { name: "Padel" });
    await expect(editor.getByRole("button", { name: /^Tidspunkt/ })).toContainText("07:00");
    // A second time starts as the first; the rows under it are its own.
    await editor.getByRole("button", { name: "Tilføj et tidspunkt" }).click();
    await expect(editor.getByRole("button", { name: /^Tid 2/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await editor.getByRole("button", { name: "Mere fleksibel" }).click();
    await editor.getByRole("button", { name: "Mere fleksibel" }).click();
    await expect(editor.getByText("1 t", { exact: true })).toBeVisible();
    // Back on the first, its own time again; and the second still its own.
    await editor.getByRole("button", { name: /^Tid 1/ }).click();
    await expect(editor.getByText("0 min", { exact: true })).toBeVisible();
    await editor.getByRole("button", { name: /^Tid 2/ }).click();
    await expect(editor.getByText("1 t", { exact: true })).toBeVisible();
    // A third, then no more to add; taken away with the cross on it.
    await editor.getByRole("button", { name: "Tilføj et tidspunkt" }).click();
    await expect(editor.getByRole("button", { name: "Tilføj et tidspunkt" })).toHaveCount(0);
    await editor.getByRole("button", { name: "Fjern tid 3" }).click();
    await expect(editor.getByRole("button", { name: /^Tid 3/ })).toHaveCount(0);

    // Each time says its start and end.
    await expect(editor.getByRole("button", { name: /^Tid 1/ })).toContainText("07:00-08:30");
    await editor.getByRole("button", { name: "Gem genvej" }).click();
    await expect(shortcuts.getByRole("button", { name: "Planlæg Padel" })).toBeVisible();
    await expect.poll(() => backend.calls.filter((c) => c.name === "plan-presets").length).toBe(2);
    const saved = backend.world.presets[0].plan as {
      times: { startHour: number; startWindow: { from: number; to: number } | null }[];
    };
    expect(saved.times).toMatchObject([
      { startHour: 7, startWindow: null },
      { startHour: 7, startWindow: { from: 360, to: 480 } },
    ]);
  });

  test("a genvej with two times looks at both", async ({ page, backend }) => {
    backend.world.presets.push(padel([{ startHour: 8 }, { startHour: 19 }]));
    await page.goto("/calendar-overview");
    await page.getByRole("button", { name: "Planlæg" }).click();
    await pickGroup(page, "Løbeklubben");
    await page
      .getByRole("dialog", { name: "Planlæg" })
      .getByRole("button", { name: "Genveje", exact: true })
      .click();
    await page.getByRole("button", { name: "Planlæg Padel" }).click();
    // Both times shown before it runs.
    const preview = page.getByRole("region", { name: "Padel" });
    await expect(preview).toContainText("08:00-09:30");
    await expect(preview).toContainText("19:00-20:30");
    await page.getByRole("button", { name: "Find dato" }).click();
    await expect(page.getByText("De 5 bedste datoer")).toBeVisible();
    // The dates listed come from both: mornings and evenings, ranked together.
    await expect(page.getByText("08:00-09:30").first()).toBeVisible();
    await expect(page.getByText("19:00-20:30").first()).toBeVisible();
  });

  test("a genvej is in its square at once; one that fails to save says so and tries again", async ({
    page,
    backend,
  }) => {
    // The first save fails, the second goes through.
    let saves = 0;
    await page.route(/functions\/v1\/plan-presets/, (route) => {
      const body = route.request().postDataJSON() as { action?: string } | null;
      if (body?.action === "save" && saves++ === 0) {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ error: "Something went wrong. Please try again." }),
        });
      }
      return route.fallback();
    });
    await page.goto("/calendar-overview");
    await page.getByRole("button", { name: "Planlæg" }).click();
    await page
      .getByRole("dialog", { name: "Planlæg" })
      .getByRole("button", { name: "Genveje", exact: true })
      .click();
    const shortcuts = page.getByRole("dialog", { name: "Genveje" });
    await shortcuts.getByRole("button", { name: "Ny genvej" }).first().click();
    const editor = page.getByRole("dialog", { name: "Ny genvej" });
    await editor.getByRole("textbox", { name: /Navn på genvej/ }).fill("Padel");
    await editor.getByRole("button", { name: "Gem genvej" }).click();

    const failedSquare = shortcuts.getByRole("button", { name: /^Padel: Ikke gemt/ });
    await expect(failedSquare).toBeVisible();
    expect(backend.world.presets).toHaveLength(0);
    await failedSquare.click();
    await expect(shortcuts.getByRole("button", { name: "Planlæg Padel" })).toBeVisible();
    await expect(failedSquare).toHaveCount(0);
    await expect.poll(() => backend.world.presets.length).toBe(1);
    expect(backend.world.presets).toMatchObject([{ name: "Padel" }]);
  });

  test("a genvej is deleted last, asked first", async ({ page, backend }) => {
    backend.world.presets.push(padel([{ startHour: 7 }]));
    await page.goto("/calendar-overview");
    await page.getByRole("button", { name: "Planlæg" }).click();
    await page
      .getByRole("dialog", { name: "Planlæg" })
      .getByRole("button", { name: "Genveje", exact: true })
      .click();
    const shortcuts = page.getByRole("dialog", { name: "Genveje" });
    await shortcuts.getByRole("button", { name: "Ret Padel" }).click();
    const editor = page.getByRole("dialog", { name: "Padel" });
    await editor.getByRole("button", { name: "Slet genvej" }).click();
    await editor.getByRole("button", { name: "Slet genvej" }).last().click();
    await expect(shortcuts.getByRole("button", { name: "Ny genvej" })).toHaveCount(3);
    expect(backend.world.presets).toHaveLength(0);
  });

  test("a genvej's picture is picked in its editor, saved with it, shown on its square, and removed (#186)", async ({
    page,
    backend,
  }) => {
    backend.world.presets.push(padel([{ startHour: 7 }]));
    await page.goto("/calendar-overview");
    await page.getByRole("button", { name: "Planlæg" }).click();
    await page
      .getByRole("dialog", { name: "Planlæg" })
      .getByRole("button", { name: "Genveje", exact: true })
      .click();
    const shortcuts = page.getByRole("dialog", { name: "Genveje" });
    const square = shortcuts.getByRole("button", { name: "Planlæg Padel" });
    await expect(square.locator("img")).toHaveCount(0);

    // Picked in the editor, and nothing sent until the genvej is saved.
    await shortcuts.getByRole("button", { name: "Ret Padel" }).click();
    const editor = page.getByRole("dialog", { name: "Padel" });
    await expect(editor.getByRole("button", { name: /^Billede/ })).toContainText("Tilføj");
    await editor
      .locator('input[type="file"][accept="image/*"]')
      .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
    await expect(editor.getByRole("button", { name: /^Billede/ }).locator("img")).toBeVisible();
    expect(backend.calls.filter((c) => c.body.action === "save")).toHaveLength(0);
    await editor.getByRole("button", { name: "Gem genvej" }).click();

    // Sent as a small JPEG with the genvej, and on its square at once.
    await expect
      .poll(() => backend.calls.find((c) => c.body.action === "save")?.body.picture)
      .toMatch(/^\/9j\//);
    await expect(square.locator("img")).toBeVisible();
    await expect(square).toHaveText("Padel");
    await expect.poll(() => backend.world.presets[0].pictureUrl).toMatch(/^data:image\/jpeg/);

    // Saved again without touching it, it keeps it; "Fjern billede" takes it off.
    await shortcuts.getByRole("button", { name: "Ret Padel" }).click();
    await editor.getByRole("button", { name: "Gem genvej" }).click();
    await expect.poll(() => backend.calls.filter((c) => c.body.action === "save").length).toBe(2);
    expect(backend.calls.filter((c) => c.body.action === "save")[1].body).not.toHaveProperty(
      "picture",
    );
    await shortcuts.getByRole("button", { name: "Ret Padel" }).click();
    await editor.getByRole("button", { name: "Fjern billede" }).click();
    await expect(editor.getByRole("button", { name: /^Billede/ })).toContainText("Tilføj");
    await editor.getByRole("button", { name: "Gem genvej" }).click();
    await expect(square.locator("img")).toHaveCount(0);
    await expect.poll(() => backend.world.presets[0].pictureUrl).toBeNull();
  });
});
