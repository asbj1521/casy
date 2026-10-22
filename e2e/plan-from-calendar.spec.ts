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

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the pile plays, and a tap skips straight to the dates", async ({ page }) => {
    await page.goto("/calendar-overview");
    await page.getByRole("button", { name: "Planlæg" }).click();
    await page.getByRole("button", { name: "Find dato" }).click();
    await expect(page.getByText("Lægger alles kalendere oven på din")).toBeVisible();
    await expect(page.getByRole("button", { name: "Foreslå top 5 datoer" })).toHaveCount(0);

    await page.getByText("Tryk for at springe over").click();
    await expect(page.getByText("De 5 bedste datoer")).toBeVisible();
    await expect(page.getByRole("button", { name: "Foreslå top 5 datoer" })).toBeEnabled();
  });
});
