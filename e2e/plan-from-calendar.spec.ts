/** Planning from My calendar on a phone (#126): the Planlæg sheet, the paper pile, the dates sent. */
import { expect, test } from "./fixtures";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "phones only"));

test("Planlæg opens over the calendar, and the dates found are sent as they were shown", async ({
  page,
  backend,
}) => {
  await page.goto("/calendar-overview");
  await page.getByRole("button", { name: "Planlæg" }).click();
  await expect(page).toHaveURL(/\?plan$/);
  const sheet = page.getByRole("dialog", { name: "Planlæg" });
  await expect(sheet.getByText("Løbeklubben")).toBeVisible();

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
  await expect(page).toHaveURL(/\/events$/);
});

test("back closes the sheet, and Ret planen goes from the dates back to it", async ({ page }) => {
  await page.goto("/calendar-overview");
  await page.getByRole("button", { name: "Planlæg" }).click();
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Planlæg" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/calendar-overview$/);

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
});
