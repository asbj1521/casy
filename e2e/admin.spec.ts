/** Admin mode (computers): the overview, and switching AI (#111) on for someone, and making them an AI tester. */
import { expect, test } from "./fixtures";

test.beforeEach(({ isMobile }) => test.skip(isMobile, "computers only"));

test("admin mode shows the AI's use, and switches AI on for someone", async ({ page, backend }) => {
  backend.world.admin = "current";
  await page.goto("/profile?mode=admin");
  await expect(page.getByText("AI i dag: 3 af 500 kald brugt.")).toBeVisible();
  await expect(page.getByText(/^Planlæg med AI: 3 i dag, 40 på 30 dage/)).toBeVisible();
  await page.getByRole("button", { name: /^Brugere/ }).click();
  await expect(page.getByText("AI: admin")).toBeVisible();

  const allow = page.getByRole("button", { name: "Slå AI til for Sara" });
  await expect(allow).toHaveAttribute("aria-pressed", "false");
  await allow.click();
  await expect
    .poll(() => backend.calls.find((c) => c.body.action === "setAiAccess")?.body)
    .toMatchObject({ profileId: "p-sara", allowed: true });
  await expect(page.getByRole("button", { name: "Slå AI fra for Sara" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("someone with AI on can be made an AI tester, for the admin-only AI features", async ({
  page,
  backend,
}) => {
  backend.world.admin = "current";
  await page.goto("/profile?mode=admin");
  await page.getByRole("button", { name: /^Brugere/ }).click();
  // No tester switch until AI is on.
  await expect(page.getByRole("button", { name: /Gør Sara til AI-tester/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Slå AI til for Sara" }).click();

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
  await expect(page.getByRole("button", { name: /Slå AI til/ })).toHaveCount(0);
});
