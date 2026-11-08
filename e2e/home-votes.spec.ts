/** Votes on the phone's home page (#172): pencilled in, answered over the month, agreed dates flying in. */
import { expect, test } from "./fixtures";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "phones only"));

test("a waiting vote is answered over the day view, which moves on to each date", async ({
  page,
  backend,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Svar på Brætspilsaften" }).click();
  await expect(page).toHaveURL(/\/\?vote=ev-boardgames$/);
  const card = page.getByRole("region", { name: "Brætspilsaften" });
  await expect(card.getByText("Dato 1 af 3", { exact: true })).toBeVisible();
  // The day view is on the first date's day (#176), the date pencilled into its hours.
  // The day view, named by its day; its buttons are the page's toolbar (#180).
  const view = page.getByRole("region", {
    name: /^(Mandag|Tirsdag|Onsdag|Torsdag|Fredag|Lørdag|Søndag) \d+\. \p{L}+$/u,
  });
  await expect(view).toHaveAccessibleName("Onsdag 14. oktober");
  await expect(view.getByText("onsdag 14. okt. 2026")).toBeVisible();

  await card.getByRole("button", { name: "Jeg kan", exact: true }).click();
  await expect(card.getByText("Dato 2 af 3", { exact: true })).toBeVisible();
  await expect(view).toHaveAccessibleName("Lørdag 17. oktober");
  await expect.poll(() => backend.calls.filter((c) => c.body.action === "answer").length).toBe(1);
  // Back to the date before, to change the answer.
  await card.getByRole("button", { name: "Forrige dato" }).click();
  await expect(card.getByText("Dato 1 af 3", { exact: true })).toBeVisible();
  await expect(view).toHaveAccessibleName("Onsdag 14. oktober");

  // Færdig leaves the rest for later, back on the month, the vote put away (#241).
  await card.getByRole("button", { name: "Færdig" }).click();
  await expect(card).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect(view).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Svar på Brætspilsaften" })).toHaveCount(0);
  // The app opened again: there it is.
  await page.reload();
  await expect(page.getByRole("button", { name: "Svar på Brætspilsaften" })).toBeVisible();
});

test("a vote answered to the end goes back to the month, from the day view too", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Fredag 16\. oktober/i }).click();
  await expect(page.getByRole("region", { name: "Fredag 16. oktober" })).toBeVisible();
  // To the vote's Saturday in the day view, and its dashed date there.
  await page.getByRole("button", { name: "17", exact: true }).click();
  await page
    .getByRole("region", { name: "Lørdag 17. oktober" })
    .getByRole("button", { name: /^Brætspilsaften/ })
    .click();
  const card = page.getByRole("region", { name: "Brætspilsaften" });
  for (let i = 1; i <= 3; i++) {
    await expect(card.getByText(`Dato ${i} af 3`, { exact: true })).toBeVisible();
    await card.getByRole("button", { name: "Jeg kan", exact: true }).click();
  }
  await expect(page.getByText("Tak, du har svaret").first()).toBeVisible();
  // Past the day view it was opened from, onto the month.
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: /Vis Oktober/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Planlæg", exact: true })).toBeVisible();
});

test("while answering, the month is free to look through, the card along its bottom", async ({
  page,
}) => {
  await page.goto("/?vote=ev-boardgames");
  const card = page.getByRole("region", { name: "Brætspilsaften" });
  await expect(card.getByText("Dato 1 af 3", { exact: true })).toBeVisible();
  // Out onto the whole month: the vote stays, folded to its card.
  await page.getByRole("button", { name: "Vis Oktober" }).click();
  await expect(page.getByRole("button", { name: "Vis Oktober" })).toHaveCount(0);
  await expect(page).toHaveURL(/\?vote=ev-boardgames$/);
  await expect(card.getByText("Dato 1 af 3", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Jeg kan", exact: true })).toHaveCount(0);
  // Any day opens in the day view, the vote still on.
  await page.getByRole("button", { name: /^fredag 23\. oktober/i }).click();
  await expect(page.getByRole("region", { name: "Fredag 23. oktober" })).toBeVisible();
  // A tap on the card: back to the date being answered, the answers there.
  await card.getByText("Dato 1 af 3", { exact: true }).click();
  await expect(page.getByRole("region", { name: "Onsdag 14. oktober" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Jeg kan", exact: true })).toBeVisible();
});

test("a touch on the calendar folds the vote down to its card, which a tap unfolds", async ({
  page,
}) => {
  await page.goto("/?vote=ev-boardgames");
  const card = page.getByRole("region", { name: "Brætspilsaften" });
  await expect(card.getByRole("button", { name: "Jeg kan", exact: true })).toBeVisible();
  // A finger on the hours: only the date's card stays, to be swiped.
  await page.getByText("onsdag 14. okt. 2026").click();
  await expect(card.getByRole("button", { name: "Jeg kan", exact: true })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Færdig" })).toHaveCount(0);
  await expect(card.getByText("Dato 1 af 3", { exact: true })).toBeVisible();
  // A tap on the card brings the rest back.
  await card.getByText("Dato 1 af 3", { exact: true }).click();
  await expect(card.getByRole("button", { name: "Jeg kan", exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Færdig" })).toBeVisible();
});

test("folded down to its card, the vote can still be put away unanswered (#241)", async ({
  page,
  backend,
}) => {
  await page.goto("/?vote=ev-boardgames");
  const card = page.getByRole("region", { name: "Brætspilsaften" });
  await page.getByText("onsdag 14. okt. 2026").click();
  await expect(card.getByRole("button", { name: "Færdig" })).toHaveCount(0);

  await card.getByRole("button", { name: "Senere" }).click();
  await expect(card).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Svar på Brætspilsaften" })).toHaveCount(0);
  expect(backend.calls.some((c) => c.body.action === "answer")).toBe(false);
});

test("a pencilled date opens its vote, from the month and the day view, and the old swipe address leads here", async ({
  page,
}) => {
  await page.goto("/");
  // Onsdag 14. oktober is the vote's first date.
  await page.getByRole("button", { name: /^Onsdag 14\. oktober/i }).click();
  await expect(page.getByRole("region", { name: "Brætspilsaften" })).toBeVisible();

  // In the day view the date is a dashed block over its hours.
  await page.goto("/?day=2026-10-17");
  await page
    .getByRole("region", { name: "Lørdag 17. oktober" })
    .getByRole("button", { name: /^Brætspilsaften/ })
    .click();
  await expect(page).toHaveURL(/\?vote=ev-boardgames$/);
  await expect(page.getByRole("region", { name: "Brætspilsaften" })).toBeVisible();

  // Push notifications still open the swipe screen's address.
  await page.goto("/events/ev-boardgames/dates");
  await expect(page).toHaveURL(/\/\?vote=ev-boardgames$/);
  await expect(page.getByRole("region", { name: "Brætspilsaften" })).toBeVisible();
});

test("decided events show in their days, and in the day view, opening Aftaler", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Løbetur", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Søndag 11\. oktober/i }).click();
  const day = page.getByRole("region", { name: "Søndag 11. oktober" });
  await day.getByRole("button", { name: /^Løbetur/ }).click();
  await expect(page).toHaveURL(/\?events$/);
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

test.describe("on the smallest iPhone (#214)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("the faces stay inside the card, and over half the screen is left for the day", async ({
    page,
  }) => {
    await page.goto("/?vote=ev-boardgames");
    const panel = page.getByRole("region", { name: "Brætspilsaften" });
    const answer = panel.getByRole("button", { name: "Jeg kan", exact: true });
    await expect(answer).toBeVisible();

    const face = await panel.getByRole("listitem").first().boundingBox();
    const button = await answer.boundingBox();
    expect(face!.y + face!.height).toBeLessThanOrEqual(button!.y);
    const box = await panel.boundingBox();
    expect(box!.height).toBeLessThan(667 * 0.58);
  });
});

test.describe("swiping a row in Aftaler (#223)", () => {
  async function swipe(page: import("@playwright/test").Page, name: RegExp) {
    const row = page.getByRole("button", { name });
    await expect(row).toBeVisible();
    const box = (await row.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width - 20, y);
    await page.mouse.down();
    for (const dx of [20, 60, 120, 180]) await page.mouse.move(box.x + box.width - 20 - dx, y);
    await page.mouse.up();
  }

  test("your own event is cancelled, asked first under its row", async ({ page, backend }) => {
    await page.goto("/?events");
    await swipe(page, /^Julefrokost/);
    await page.getByRole("button", { name: "Aflys", exact: true }).click();
    expect(backend.calls.some((c) => c.body.action === "cancel")).toBe(false);
    await expect(page.getByText("Aflys aftalen for alle?")).toBeVisible();
    await page.getByRole("button", { name: "Aflys aftale", exact: true }).click();
    await expect
      .poll(() => backend.calls.find((c) => c.body.action === "cancel")?.body)
      .toMatchObject({ proposalId: "ev-party" });
  });

  test("someone else's event is left at the press", async ({ page, backend }) => {
    await page.goto("/?events");
    await swipe(page, /^Løbetur/);
    expect(backend.calls.some((c) => c.body.action === "leave")).toBe(false);
    await page.getByRole("button", { name: "Forlad", exact: true }).click();
    await expect
      .poll(() => backend.calls.find((c) => c.body.action === "leave")?.body)
      .toMatchObject({ proposalId: "ev-run" });
  });

  test("a tap on a row left alone still opens it", async ({ page }) => {
    await page.goto("/?events");
    await page.getByRole("button", { name: /^Løbetur/ }).click();
    await expect(page).toHaveURL(/events=ev-run/);
  });
});
