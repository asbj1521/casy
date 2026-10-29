/** Votes on the phone's home page (#172): pencilled in, answered over the month, agreed dates flying in. */
import { expect, test } from "./fixtures";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "phones only"));

test("a waiting vote is pencilled into its days, and the pill answers it over the month", async ({
  page,
  backend,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Svar på Brætspilsaften" }).click();
  await expect(page).toHaveURL(/\/\?vote=ev-boardgames$/);
  const card = page.getByRole("region", { name: "Brætspilsaften" });
  await expect(card.getByText("Dato 1 af 3", { exact: true })).toBeVisible();

  await card.getByRole("button", { name: "Jeg kan", exact: true }).click();
  await expect(card.getByText("Dato 2 af 3", { exact: true })).toBeVisible();
  await expect.poll(() => backend.calls.filter((c) => c.body.action === "answer").length).toBe(1);
  // Back to the date before, to change the answer.
  await card.getByRole("button", { name: "Forrige dato" }).click();
  await expect(card.getByText("Dato 1 af 3", { exact: true })).toBeVisible();

  // Færdig leaves the rest for later.
  await card.getByRole("button", { name: "Færdig" }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Svar på Brætspilsaften" })).toBeVisible();
});

test("a pencilled date opens its vote, and the old swipe address leads here", async ({ page }) => {
  await page.goto("/");
  // Onsdag 14. oktober is the vote's first date.
  await page.getByRole("button", { name: /^Onsdag 14\. oktober/i }).click();
  await expect(page.getByRole("region", { name: "Brætspilsaften" })).toBeVisible();

  // Push notifications still open the swipe screen's address.
  await page.goto("/events/ev-boardgames/dates");
  await expect(page).toHaveURL(/\/\?vote=ev-boardgames$/);
  await expect(page.getByRole("region", { name: "Brætspilsaften" })).toBeVisible();
});

test("decided events show in their days in Casy's orange", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Løbetur", { exact: true })).toBeVisible();
});

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("a date agreed since this phone last looked is said over the month, then flies into its day", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("casy-decided-seen", "[]");
        sessionStorage.setItem("seeded", "1");
      }
    });
    await page.goto("/");
    const card = page.getByRole("dialog", { name: "Løbetur" });
    await expect(card.getByText("Alle har svaret")).toBeVisible();
    await expect(card.getByRole("button", { name: /Tilføj til min kalender/ })).toBeVisible();
    await card.getByRole("button", { name: "Se den i kalenderen" }).click();
    await expect(card).toHaveCount(0);
    // Remembered as it lands, and drawn in its day.
    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem("casy-decided-seen")), {
        timeout: 10_000,
      })
      .toContain("ev-run");
    await expect(page.getByText("Løbetur", { exact: true })).toBeVisible();
  });
});
