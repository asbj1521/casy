/** Admin mode (computers): the overview, and making someone an AI tester. */
import { expect, test } from "./fixtures";

test.beforeEach(({ isMobile }) => test.skip(isMobile, "computers only"));

test("admin mode shows the AI's use", async ({ page, backend }) => {
  backend.world.admin = "current";
  await page.goto("/profile?mode=admin");
  await expect(page.getByText("AI i dag: 3 af 500 kald brugt.")).toBeVisible();
  await expect(page.getByText(/^Planlæg med AI: 3 i dag, 40 på 30 dage/)).toBeVisible();
  await page.getByRole("button", { name: /^Brugere/ }).click();
  await expect(page.getByText("AI: admin")).toBeVisible();
});

test("anyone can be made an AI tester", async ({ page, backend }) => {
  backend.world.admin = "current";
  await page.goto("/profile?mode=admin");
  await page.getByRole("button", { name: /^Brugere/ }).click();

  const tester = page.getByRole("button", { name: /Gør Sara til AI-tester/ });
  await expect(tester).toHaveAttribute("aria-pressed", "false");
  await tester.click();
  await expect
    .poll(() => backend.calls.find((c) => c.body.action === "setAiTester")?.body)
    .toMatchObject({ profileId: "p-sara", allowed: true });
  await expect(
    page.getByRole("button", { name: "Sara skal ikke længere være AI-tester" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("admin mode still opens while the admin function is older than the page", async ({
  page,
  backend,
}) => {
  backend.world.admin = "beforeAi";
  await page.goto("/profile?mode=admin");
  await expect(page.getByText("AI i dag: 3 af 50 kald brugt.")).toBeVisible();
  await page.getByRole("button", { name: /^Brugere/ }).click();
  await expect(page.getByText("Sara", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /AI-tester/ })).toHaveCount(0);
});
