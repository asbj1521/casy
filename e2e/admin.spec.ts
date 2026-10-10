/** Admin mode (computers): the overview, and switching AI on for someone (#111). */
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
