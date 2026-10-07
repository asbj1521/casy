/**
 * The scheduling page: the answer for a real group, and "Suggest dates"
 * sending it with the other good dates as a vote. The page is reworked next
 * (more settings and preferences), so this stays to the basics until then.
 */
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
