/** The page an invite link lands on (#211): what a friend who has never heard of Casy sees first. */
import { expect, test } from "./fixtures";

test.describe("signed out", () => {
  test.use({ signedIn: false });

  test("says who invited you, to what, and what Casy is, before asking for an account", async ({
    page,
  }) => {
    await page.goto("/join/a-token");
    await expect(page.getByRole("heading", { name: "Sara har inviteret dig til" })).toBeVisible();
    await expect(page.getByText("Sommerhuset")).toBeVisible();
    await expect(page.getByText("4 medlemmer indtil videre")).toBeVisible();
    await expect(page.getByText(/^Casy finder de datoer/)).toBeVisible();

    await page.getByRole("link", { name: "Log ind for at blive medlem" }).click();
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fjoin%2Fa-token/);
  });

  test("a link whose maker's account is gone still says what it is for", async ({ page }) => {
    await page.goto("/join/orphan-token");
    await expect(page.getByRole("heading", { name: "Du er inviteret til" })).toBeVisible();
    await expect(page.getByText("Sommerhuset")).toBeVisible();
  });

  test("an expired link says so and asks for a new one", async ({ page }) => {
    await page.goto("/join/expired-token");
    await expect(page.getByRole("heading", { name: "Invitationen virker ikke" })).toBeVisible();
  });

  test("in English too", async ({ page }) => {
    await page.goto("/join/a-token?lang=en");
    await expect(page.getByRole("heading", { name: "Sara has invited you to" })).toBeVisible();
    await expect(page.getByText(/^Casy finds the dates/)).toBeVisible();
  });
});

test("signed in, one press joins, with no word on what Casy is", async ({ page, backend }) => {
  await page.goto("/join/a-token");
  await expect(page.getByRole("heading", { name: "Sara har inviteret dig til" })).toBeVisible();
  await expect(page.getByText(/^Casy finder de datoer/)).toHaveCount(0);
  await page.getByRole("button", { name: "Bliv medlem" }).click();
  await expect.poll(() => backend.calls.find((c) => c.body.action === "join")).toBeTruthy();
  await expect(page).toHaveURL(/\/$/);
});
