/**
 * Admin mode on a phone (#128): a user's row gives the name and the dates the
 * full width instead of squeezing them beside the numbers and buttons.
 */
import { expect, test } from "./fixtures";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "phones only"));

test("a user's dates sit above one line: the AI switches left, the numbers and buttons right", async ({
  page,
  backend,
}) => {
  backend.world.admin = "current";
  backend.world.aiAccess.add("p-sara");
  await page.goto("/profile/admin");
  await page.getByRole("button", { name: /^Brugere/ }).click();

  const sara = page.getByRole("listitem").filter({ hasText: "Sara" }).first();
  const box = async (locator: import("@playwright/test").Locator) => (await locator.boundingBox())!;

  // The dates fit on one line, above everything else.
  const dates = sara.getByText(/^Oprettet/);
  expect((await box(dates)).height).toBeLessThan(20);

  // The AI switches, the two numbers, sync and delete share one line.
  const ai = sara.getByRole("button", { name: "Slå AI fra for Sara" });
  const tester = sara.getByRole("button", { name: /Gør Sara til AI-tester/ });
  const groups = sara.getByTitle(/grupper$/);
  const calendars = sara.getByTitle(/kalendere$/);
  const sync = sara.getByRole("button", { name: /^Synkronisér alle kalendere for Sara/ });
  const remove = sara.getByRole("button", { name: /^Slet kontoen for Sara|^Slet Sara/ });
  const middle = async (l: import("@playwright/test").Locator) => {
    const b = await box(l);
    return b.y + b.height / 2;
  };
  const line = await middle(ai);
  for (const other of [tester, groups, calendars, sync, remove]) {
    expect(Math.abs((await middle(other)) - line)).toBeLessThan(4);
  }
  expect((await box(dates)).y).toBeLessThan((await box(ai)).y);

  // Left to right: the switches, then the numbers, then the buttons at the right edge.
  expect((await box(ai)).x).toBeLessThan((await box(tester)).x);
  expect((await box(tester)).x).toBeLessThan((await box(groups)).x);
  expect((await box(groups)).x).toBeLessThan((await box(calendars)).x);
  expect((await box(calendars)).x).toBeLessThan((await box(sync)).x);
  expect((await box(sync)).x).toBeLessThan((await box(remove)).x);
});

test("the three tabs fit inside the card, even in Danish", async ({ page, backend }) => {
  backend.world.admin = "current";
  await page.goto("/profile/admin");
  const card = page
    .getByRole("button", { name: /^Grupper/ })
    .locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
  const last = page.getByRole("button", { name: /^Kalendersundhed/ });
  const right = (await last.boundingBox())!.x + (await last.boundingBox())!.width;
  const cardBox = (await card.boundingBox())!;
  expect(right).toBeLessThanOrEqual(cardBox.x + cardBox.width);
});
