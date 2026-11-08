/** Searching an open vote again, with the members it left out (#240): the app only. */
import type { Page } from "@playwright/test";

import type { FakeBackend } from "./backend";
import { expect, test } from "./fixtures";
import { PEOPLE } from "./world";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "the app is a phone"));

const asTheApp = (page: Page) =>
  page.addInitScript(() => {
    (window as unknown as { Capacitor: object }).Capacitor = { isNativePlatform: () => true };
  });

/** The cinema vote, Oliver having joined Løbeklubben after it was made. */
const withoutOliver = (backend: FakeBackend) => {
  const cinema = backend.world.events.find((e) => e.id === "ev-cinema")!;
  cinema.invitees = cinema.invitees.filter((i) => i.profileId !== PEOPLE.oliver.id);
};

test("someone the vote left out is added, the dates found in Planlæg, and sent after a warning", async ({
  page,
  backend,
}) => {
  withoutOliver(backend);
  await asTheApp(page);
  await page.goto("/?events=ev-cinema");
  const vote = page.getByRole("dialog", { name: "Biograf" });

  await vote.getByRole("button", { name: /1 i gruppen er ikke med/ }).click();
  const picking = page.getByRole("dialog", { name: "Tilføj til afstemningen" });
  await expect(picking.getByRole("checkbox", { name: "Oliver" })).toBeChecked();
  await picking.getByRole("button", { name: "Søg igen" }).click();

  // Planlæg's own pile, straight to its list (reduced motion), saying the dates are new.
  await expect(page).toHaveURL(/\?plan$/);
  await expect(page.getByText("De 2 bedste nye datoer")).toBeVisible();
  // Nothing has changed yet.
  expect(backend.calls.some((c) => c.body.action === "search-again")).toBe(false);

  await page.getByRole("button", { name: "Send 2 nye datoer" }).click();
  const sure = page.getByRole("dialog", { name: "Er du sikker?" });
  await expect(sure.getByText("Hvis I søger igen, skal alle stemme igen.")).toBeVisible();
  await sure.getByRole("button", { name: "Send 2 nye datoer" }).click();

  await expect
    .poll(() => backend.calls.find((c) => c.body.action === "search-again")?.body)
    .toMatchObject({ proposalId: "ev-cinema", add: [PEOPLE.oliver.id] });
  const sent = backend.calls.find((c) => c.body.action === "search-again")!.body;
  expect(sent.dates).toHaveLength(2);
  // Nobody's answers ride along: everyone votes on the new dates.
  expect((sent.dates as Record<string, unknown>[]).every((d) => !("answer" in d))).toBe(true);
  // Back on the vote, Oliver in it.
  await expect(vote.getByRole("button", { name: /i gruppen er ikke med/ })).toHaveCount(0);
});

test("searching again with nobody added opens Planlæg the same way", async ({ page, backend }) => {
  await asTheApp(page);
  await page.goto("/?events=ev-cinema");
  const vote = page.getByRole("dialog", { name: "Biograf" });
  await expect(vote.getByRole("button", { name: /i gruppen er ikke med/ })).toHaveCount(0);
  await vote.getByRole("button", { name: "Søg igen" }).click();

  await expect(page.getByText("De 2 bedste nye datoer")).toBeVisible();
  await page.getByRole("button", { name: "Send 2 nye datoer" }).click();
  await page
    .getByRole("dialog", { name: "Er du sikker?" })
    .getByRole("button", { name: "Send 2 nye datoer" })
    .click();
  await expect
    .poll(() => backend.calls.find((c) => c.body.action === "search-again")?.body)
    .toMatchObject({ proposalId: "ev-cinema", add: [] });
});

test("when the server turns the new dates down, it says so, and nothing has changed", async ({
  page,
  backend,
}) => {
  await asTheApp(page);
  // A server without the action yet (its deploy not done).
  await page.route("**/functions/v1/events?*", async (route) => {
    if (route.request().postDataJSON()?.action !== "search-again") return route.fallback();
    await route.fulfill({ status: 400, json: { error: "Unknown action: search-again" } });
  });
  await page.goto("/?events=ev-cinema");
  await page
    .getByRole("dialog", { name: "Biograf" })
    .getByRole("button", { name: "Søg igen" })
    .click();
  await page.getByRole("button", { name: "Send 2 nye datoer" }).click();
  await page
    .getByRole("dialog", { name: "Er du sikker?" })
    .getByRole("button", { name: "Send 2 nye datoer" })
    .click();
  await expect(page.getByText("Unknown action: search-again")).toBeVisible();
  expect(backend.calls.some((c) => c.body.action === "search-again")).toBe(false);
});

test("the website has none of it", async ({ page }) => {
  await page.goto("/?events=ev-cinema");
  const vote = page.getByRole("dialog", { name: "Biograf" });
  await expect(vote).toBeVisible();
  await expect(vote.getByRole("button", { name: "Søg igen" })).toHaveCount(0);
});

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the calendars searched before lie on the pile; only the one added is thrown", async ({
    page,
    backend,
  }) => {
    withoutOliver(backend);
    await asTheApp(page);
    await page.goto("/?events=ev-cinema");
    await page
      .getByRole("dialog", { name: "Biograf" })
      .getByRole("button", { name: /1 i gruppen er ikke med/ })
      .click();
    await page
      .getByRole("dialog", { name: "Tilføj til afstemningen" })
      .getByRole("button", { name: "Søg igen" })
      .click();

    const pile = page.locator("[data-pile]");
    await expect(pile.getByText("Freja", { exact: true })).toBeVisible();
    await expect(pile.getByText("Oliver", { exact: true })).toBeVisible();
    // Then the whole of the rest, to the list of new dates.
    await expect(page.getByText("De 2 bedste nye datoer")).toBeVisible({ timeout: 20_000 });
  });
});
