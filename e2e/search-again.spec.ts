/** Searching an open vote again, with the members it left out (#240): the app only. */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { PEOPLE } from "./world";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "the app is a phone"));

const asTheApp = (page: Page) =>
  page.addInitScript(() => {
    (window as unknown as { Capacitor: object }).Capacitor = { isNativePlatform: () => true };
  });

test("someone the vote left out is added, and the vote searched again with them", async ({
  page,
  backend,
}) => {
  // Oliver joined Løbeklubben after the vote was made.
  const cinema = backend.world.events.find((e) => e.id === "ev-cinema")!;
  cinema.invitees = cinema.invitees.filter((i) => i.profileId !== PEOPLE.oliver.id);
  await asTheApp(page);
  await page.goto("/?events=ev-cinema");
  const vote = page.getByRole("dialog", { name: "Biograf" });

  await vote.getByRole("button", { name: /1 i gruppen er ikke med/ }).click();
  const picking = page.getByRole("dialog", { name: "Tilføj til afstemningen" });
  // Everyone left out is ticked to begin with, and it says what searching does.
  await expect(picking.getByRole("checkbox", { name: "Oliver" })).toBeChecked();
  await expect(picking.getByText("Hvis I søger igen, skal alle stemme igen.")).toBeVisible();
  await picking.getByRole("button", { name: "Søg igen" }).click();

  await expect
    .poll(() => backend.calls.find((c) => c.body.action === "search-again")?.body)
    .toMatchObject({ proposalId: "ev-cinema", add: [PEOPLE.oliver.id] });
  const sent = backend.calls.find((c) => c.body.action === "search-again")!.body;
  expect((sent.dates as unknown[]).length).toBe(2);
  // In the vote now, so nobody is left out.
  await expect(vote.getByRole("button", { name: /i gruppen er ikke med/ })).toHaveCount(0);
});

test("searching again with nobody added asks first: everyone votes again", async ({
  page,
  backend,
}) => {
  await asTheApp(page);
  await page.goto("/?events=ev-cinema");
  const vote = page.getByRole("dialog", { name: "Biograf" });
  await expect(vote.getByRole("button", { name: /i gruppen er ikke med/ })).toHaveCount(0);

  await vote.getByRole("button", { name: "Søg igen" }).click();
  const sure = page.getByRole("dialog", { name: "Er du sikker?" });
  await expect(sure.getByText("Hvis I søger igen, skal alle stemme igen.")).toBeVisible();
  await sure.getByRole("button", { name: "Søg igen" }).click();
  await expect
    .poll(() => backend.calls.find((c) => c.body.action === "search-again")?.body)
    .toMatchObject({ proposalId: "ev-cinema", add: [] });
});

test("the website has none of it", async ({ page }) => {
  await page.goto("/?events=ev-cinema");
  const vote = page.getByRole("dialog", { name: "Biograf" });
  await expect(vote).toBeVisible();
  await expect(vote.getByRole("button", { name: "Søg igen" })).toHaveCount(0);
});
