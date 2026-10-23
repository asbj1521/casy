/**
 * Report and block (#142, App Store guideline 1.2): a group, an event or a
 * member can be reported to Casy, a member or an invitation's sender blocked,
 * the block removed in Your data, and admin mode deals with the reports
 * without ever saying who sent them.
 */
import { expect, test } from "./fixtures";
import { ME } from "./world";

test("a member is reported and blocked from the group, and unblocked in Your data", async ({
  page,
  backend,
}) => {
  await page.goto("/groups/g-running");
  await page.getByRole("button", { name: /Rapportér eller bloker/ }).click();
  const dialog = page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: "Rapportér" }) });
  await dialog.getByRole("radio", { name: "Oliver" }).check();
  // A reason is needed before it can be sent.
  await expect(dialog.getByRole("button", { name: "Send" })).toBeDisabled();
  await dialog.getByRole("radio", { name: "Chikane eller trusler" }).check();
  await dialog.getByLabel("Fortæl mere (valgfrit)").fill("Skriver grimme ting i noterne");
  await dialog.getByRole("checkbox", { name: /Bloker også Oliver/ }).check();
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(dialog.getByText("Tak. Casy kigger på det.")).toBeVisible();

  expect(backend.calls.find((c) => c.body.action === "report")?.body).toMatchObject({
    kind: "member",
    groupId: "g-running",
    memberId: "p-oliver",
    reason: "harassment",
    note: "Skriver grimme ting i noterne",
  });
  expect(backend.calls.find((c) => c.body.action === "block")?.body).toMatchObject({
    profileId: "p-oliver",
  });
  await dialog.getByRole("button", { name: "Luk" }).click();

  await page.goto("/profile/data");
  await expect(page.getByText("Blokerede personer")).toBeVisible();
  await page.getByRole("button", { name: "Fjern blokering" }).click();
  await expect(page.getByText("Blokerede personer")).toHaveCount(0);
});

test("an invitation's sender is blocked, which declines it", async ({ page, backend }) => {
  await page.goto("/groups");
  await expect(page.getByText("Badminton")).toBeVisible();
  await page.getByRole("button", { name: "Bloker afsenderen" }).click();
  await page.getByRole("button", { name: "Bloker", exact: true }).click();
  await expect(page.getByText("Badminton")).toBeHidden();
  expect(backend.calls.find((c) => c.body.action === "block")?.body).toMatchObject({
    invitationGroupId: "g-badminton",
  });
});

test("someone else's event can be reported, your own can't", async ({
  page,
  isMobile,
  backend,
}) => {
  test.skip(isMobile, "the computer's event pane; the phone shares the same button");
  await page.goto("/events/ev-boardgames");
  await page.getByRole("button", { name: "Rapportér", exact: true }).click();
  const dialog = page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: "Rapportér" }) });
  await dialog.getByRole("radio", { name: "Spam eller reklame" }).check();
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(dialog.getByText("Tak. Casy kigger på det.")).toBeVisible();
  expect(backend.calls.find((c) => c.body.action === "report")?.body).toMatchObject({
    kind: "event",
    groupId: "g-friday",
    eventId: "ev-boardgames",
  });

  await page.goto("/events/ev-cinema");
  await expect(page.getByText("Biograf").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Rapportér", exact: true })).toHaveCount(0);
});

test("admin mode lists reports without who sent them, and deals with them", async ({
  page,
  backend,
}) => {
  backend.world.admin = "current";
  backend.world.reports = [
    {
      id: "r-1",
      kind: "event",
      reason: "offensive",
      note: "Ikke i orden",
      content: { groupName: "Fredagsbar", title: "Noget grimt" },
      groupId: "g-friday",
      createdAt: "2026-10-06T10:00:00.000Z",
    },
  ];
  await page.goto("/profile?mode=admin");
  await page.getByRole("button", { name: /^Rapporter/ }).click();
  await expect(page.getByText("Noget grimt")).toBeVisible();
  await expect(page.getByText(/Aftale · Stødende eller upassende/)).toBeVisible();
  await expect(page.getByText(ME.name)).toHaveCount(0);
  await page.getByRole("button", { name: "Klaret" }).click();
  await expect(page.getByText("Noget grimt")).toHaveCount(0);
  await expect(page.getByText("Ingen rapporter.")).toBeVisible();
});
