/**
 * Admin mode on a phone (#128): a user's row gives the name and the dates the
 * full width instead of squeezing them beside the numbers and buttons.
 */
import { expect, test } from "./fixtures";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "phones only"));

test("a user's dates sit above the numbers and buttons, and the AI switches side by side", async ({
  page,
  backend,
}) => {
  backend.world.admin = "current";
  backend.world.aiAccess.add("p-sara");
  await page.goto("/profile/admin");
  await page.getByRole("button", { name: /^Brugere/ }).click();

  const sara = page.getByRole("listitem").filter({ hasText: "Sara" }).first();
  const y = async (locator: import("@playwright/test").Locator) => (await locator.boundingBox())!.y;

  // The name is whole and the dates fit on one line, above the counts and buttons.
  const dates = sara.getByText(/^Oprettet/);
  expect((await dates.boundingBox())!.height).toBeLessThan(20);
  expect(await y(dates)).toBeLessThan(await y(sara.getByText("grupper")));
  expect(await y(sara.getByText("grupper"))).toBeCloseTo(
    await y(sara.getByRole("button", { name: /^Synkronisér alle kalendere for Sara/ })),
    -1,
  );

  // The two AI switches share a line.
  const ai = sara.getByRole("button", { name: "Slå AI fra for Sara" });
  const tester = sara.getByRole("button", { name: /Gør Sara til AI-tester/ });
  expect(Math.abs((await y(ai)) - (await y(tester)))).toBeLessThan(3);
  expect(await y(ai)).toBeGreaterThan(await y(sara.getByText("grupper")));
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
