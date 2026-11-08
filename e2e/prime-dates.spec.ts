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
  // Said first, what is being planned (#243).
  await expect(plan).toContainText("Tid til hinanden · Lørdag 24. oktober, Hele weekenden");
  await expect(sheet).toBeHidden();
});

test("no star for a group of three, even with nothing planned", async ({ page, backend }) => {
  // Løbeklubben as it is, three people, with its open vote taken away.
  backend.world.events = backend.world.events.filter(
    (e) => !(e.group.id === "g-running" && e.status === "pending"),
  );
  await page.goto("/");
  // Fredagsbar's busy times are looked at; Løbeklubben's, three people, never.
  await expect
    .poll(() => backend.calls.filter((c) => c.body.action === "busy").length)
    .toBeGreaterThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Planlæg" })).toBeVisible();
  await expect(starred(page)).toHaveCount(0);
  expect(
    backend.calls.some((c) => c.body.action === "busy" && c.body.groupId === "g-running"),
  ).toBe(false);
});

test("no star for a group with a member with no calendar, or one already voting", async ({
  page,
  backend,
}) => {
  // Fredagsbar has Emil, who has no calendar; Løbeklubben has a vote open.
  await page.goto("/");
  // Fredagsbar's busy times are looked at; Løbeklubben's, three people, never.
  await expect
    .poll(() => backend.calls.filter((c) => c.body.action === "busy").length)
    .toBeGreaterThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Planlæg" })).toBeVisible();
  await expect(starred(page)).toHaveCount(0);
  expect(
    backend.calls.some((c) => c.body.action === "busy" && c.body.groupId === "g-running"),
  ).toBe(false);
  expect(backend.calls.filter((c) => c.body.action === "rank-dates")).toHaveLength(0);
});

test("a group's stars are switched off on its own screen, and stay off", async ({
  page,
  backend,
}) => {
  readyForStars(backend.world);
  await page.goto("/");
  await expect(starred(page)).toHaveCount(1);

  // Profil, Grupper, Løbeklubben: the switch, on.
  await page.goto("/?profile=groups/g-running");
  const sheet = page.getByRole("dialog");
  const toggle = sheet.getByRole("switch", { name: "Tid til hinanden" });
  await expect(toggle).toBeChecked();
  await expect(sheet).toContainText("Kun du ser dem.");
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect
    .poll(() => backend.calls.find((c) => c.body.action === "set-prime-dates")?.body)
    .toEqual({ action: "set-prime-dates", groupId: "g-running", on: false });

  // Back on the month: no star for it.
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Planlæg" })).toBeVisible();
  await expect
    .poll(() => backend.calls.filter((c) => c.body.action === "busy").length)
    .toBeGreaterThanOrEqual(1);
  await expect(starred(page)).toHaveCount(0);
});

test("no switch for a group under four", async ({ page }) => {
  await page.goto("/?profile=groups/g-running");
  await expect(page.getByRole("dialog")).toContainText("Løbeklubben");
  await expect(page.getByRole("switch", { name: "Tid til hinanden" })).toHaveCount(0);
});
