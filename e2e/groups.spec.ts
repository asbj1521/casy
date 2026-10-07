/** My groups: the list, one group, and an invitation. */
import { expect, test } from "./fixtures";

test("a group opens with its members", async ({ page, isMobile }) => {
  await page.goto("/groups");
  await page
    .getByRole("link", { name: /Løbeklubben/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/groups\/g-running$/);
  for (const name of ["Freja", "Oliver"]) {
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }
  if (isMobile) {
    // A screen of its own, with a way back.
    await page
      .getByRole("link", { name: /Grupper/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/groups$/);
  }
});

test("declining an invitation removes it", async ({ page, backend }) => {
  await page.goto("/groups");
  await expect(page.getByText("Badminton")).toBeVisible();
  await page.getByRole("button", { name: "Nej tak" }).click();
  await expect(page.getByText("Badminton")).toBeHidden();
  expect(backend.calls.find((c) => c.body.action === "decline-invitation")?.body).toMatchObject({
    groupId: "g-badminton",
  });
});
