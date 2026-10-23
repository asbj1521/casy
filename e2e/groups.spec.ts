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

test("a group's invite link can be shown as a QR code to scan (#150)", async ({ page }) => {
  await page.goto("/groups/g-running");
  await page
    .getByRole("button", { name: /Invitér folk/ })
    .first()
    .click();
  // The code needs a link, so asking for it makes one.
  await page.getByRole("button", { name: "Vis QR-kode" }).click();
  await expect(
    page.getByRole("img", { name: /QR-kode til at blive medlem af Løbeklubben/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox").or(page.getByText("https://casy.app/join/test-invite-token")).first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Skjul QR-kode" }).click();
  await expect(page.getByRole("img", { name: /QR-kode/ })).toHaveCount(0);
});
