/** Tid til hinanden (#171): days a whole group is free, starred on the phone's home page. */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { PEOPLE, type World } from "./world";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "phones only"));

/**
 * Løbeklubben with Sara in it too, four with calendars, and its open vote
 * taken away: a group that gets stars.
 */
function readyForStars(world: World) {
  world.events = world.events.filter(
    (e) => !(e.group.id === "g-running" && e.status === "pending"),
  );
  world.groups
    .find((g) => g.id === "g-running")!
    .members.push({
      profileId: PEOPLE.sara.id,
      name: PEOPLE.sara.name,
      isYou: false,
      joinedAt: "2026-09-13T12:00:00.000Z",
    });
}

const starred = (page: Page) => page.getByRole("button", { name: /, Tid til hinanden$/ });

test("a starred day says which group is free, and Planlæg opens on it", async ({
  page,
  backend,
}) => {
  readyForStars(backend.world);
  await page.goto("/");
  // Its best: the weekend of 24 October, free for all four, scored once.
  await expect(starred(page)).toHaveAccessibleName("lørdag 24. oktober, Tid til hinanden");
  expect(backend.calls.filter((c) => c.body.action === "rank-dates")).toEqual([
    expect.objectContaining({ body: expect.objectContaining({ groupId: "g-running" }) }),
  ]);

  await starred(page).click();
  const sheet = page.getByRole("dialog", { name: "Tid til hinanden" });
  await expect(sheet).toContainText("Løbeklubben");
  await expect(sheet).toContainText("Lørdag 24. oktober");
  await expect(sheet).toContainText("Hele weekenden");
  await expect(sheet).toContainText("Alle 4 er fri");
  await expect(sheet).toContainText("Freja, Oliver, Sara og dig");

  // Planlæg on the group, a weekend away on those two days.
  await sheet.getByRole("button", { name: "Planlæg" }).click();
  const plan = page.getByRole("dialog", { name: "Planlæg" });
  await expect(plan).toContainText("Løbeklubben");
  await expect(plan).toContainText("2 dage");
  await expect(plan).toContainText("Casy har sat datoerne: 24. okt. til 25. okt. Tryk");
  await expect(sheet).toBeHidden();
});

test("no star for a group of three, even with nothing planned", async ({ page, backend }) => {
  // Løbeklubben as it is, three people, with its open vote taken away.
  backend.world.events = backend.world.events.filter(
    (e) => !(e.group.id === "g-running" && e.status === "pending"),
  );
  await page.goto("/");
  await expect
    .poll(() => backend.calls.filter((c) => c.body.action === "busy").length)
    .toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("button", { name: "Planlæg" })).toBeVisible();
  await expect(starred(page)).toHaveCount(0);
});

test("no star for a group with a member with no calendar, or one already voting", async ({
  page,
  backend,
}) => {
  // Fredagsbar has Emil, who has no calendar; Løbeklubben has a vote open.
  await page.goto("/");
  await expect
    .poll(() => backend.calls.filter((c) => c.body.action === "busy").length)
    .toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("button", { name: "Planlæg" })).toBeVisible();
  await expect(starred(page)).toHaveCount(0);
  expect(backend.calls.filter((c) => c.body.action === "rank-dates")).toHaveLength(0);
});
