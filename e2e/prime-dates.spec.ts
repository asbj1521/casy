/** Tid til hinanden (#171): days a whole group is free, starred on the phone's home page. */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "phones only"));

const starred = (page: Page) => page.getByRole("button", { name: /, Tid til hinanden$/ });

test("a starred day says which group is free, and Planlæg opens on it", async ({
  page,
  backend,
}) => {
  // Løbeklubben, everyone with a calendar, with its open vote taken away.
  backend.world.events = backend.world.events.filter(
    (e) => !(e.group.id === "g-running" && e.status === "pending"),
  );
  await page.goto("/");
  // Its best: the weekend of 24 October, free for all three, scored once.
  await expect(starred(page)).toHaveAccessibleName("lørdag 24. oktober, Tid til hinanden");
  expect(backend.calls.filter((c) => c.body.action === "rank-dates")).toEqual([
    expect.objectContaining({ body: expect.objectContaining({ groupId: "g-running" }) }),
  ]);

  await starred(page).click();
  const sheet = page.getByRole("dialog", { name: "Tid til hinanden" });
  await expect(sheet).toContainText("Løbeklubben");
  await expect(sheet).toContainText("Lørdag 24. oktober");
  await expect(sheet).toContainText("Hele weekenden");
  await expect(sheet).toContainText("Alle 3 er fri");
  await expect(sheet).toContainText("Freja, Oliver og dig");

  // Planlæg on the group, a weekend away on those two days.
  await sheet.getByRole("button", { name: "Planlæg" }).click();
  const plan = page.getByRole("dialog", { name: "Planlæg" });
  await expect(plan).toContainText("Løbeklubben");
  await expect(plan).toContainText("2 dage");
  await expect(plan).toContainText("Casy har sat datoerne: 24. okt. til 25. okt. Tryk");
  await expect(sheet).toBeHidden();
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

test("ideas for the time, each a way into Planlæg named after it", async ({ page, backend }) => {
  backend.world.events = backend.world.events.filter(
    (e) => !(e.group.id === "g-running" && e.status === "pending"),
  );
  await page.goto("/");
  await starred(page).click();
  const sheet = page.getByRole("dialog", { name: "Tid til hinanden" });
  const idea = sheet.getByRole("button", { name: /^Brunch og gåtur/ });
  await expect(idea).toBeVisible();
  await expect(sheet).toContainText("Skoven er flot i oktober");
  // Only the time, the group's size and what it is for: no dates, no names.
  expect(backend.calls.find((c) => c.name === "prime-ideas")?.body).toEqual({
    stretch: {
      kind: "weekend",
      startMinute: 600,
      minutes: 720,
      weekday: 6,
      month: 9,
      groupSize: 3,
      about: "",
    },
  });

  await idea.click();
  const plan = page.getByRole("dialog", { name: "Planlæg" });
  await expect(plan.getByPlaceholder("Fx fredagsbar eller brætspil")).toHaveValue(
    "Brunch og gåtur",
  );
  await expect(plan).toContainText("Løbeklubben");
});

test("no ideas, and no call, for someone the AI isn't on for", async ({ page, backend }) => {
  backend.world.aiAllowed = false;
  backend.world.events = backend.world.events.filter(
    (e) => !(e.group.id === "g-running" && e.status === "pending"),
  );
  await page.goto("/");
  await starred(page).click();
  const sheet = page.getByRole("dialog", { name: "Tid til hinanden" });
  await expect(sheet).toContainText("Alle 3 er fri");
  await expect(sheet.getByText("Idéer")).toHaveCount(0);
  expect(backend.calls.some((c) => c.name === "prime-ideas")).toBe(false);
});
