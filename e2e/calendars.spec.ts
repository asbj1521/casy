/** The calendars page (/calendar-overview/accounts): adding, syncing and removing. */
import { expect, test } from "./fixtures";

test("a provider opens its form or its consent screen", async ({ page, isMobile }) => {
  await page.goto("/calendar-overview/accounts");
  // Tiles on a computer, rows on a phone.
  const provider = (label: string) =>
    isMobile
      ? page.getByRole("button", { name: new RegExp(`^${label}`) })
      : page.getByRole("listitem").filter({ hasText: label }).getByRole("button");
  await provider("Apple-kalender").click();
  await expect(page.getByRole("textbox", { name: "Apple-konto (e-mail)" })).toBeVisible();
  await page.getByRole("button", { name: "Annuller" }).click();
  await expect(page.getByRole("textbox", { name: "Apple-konto (e-mail)" })).toBeHidden();

  // Outlook goes to Microsoft's consent screen (here a stand-in page).
  await provider("Outlook-kalender").click();
  await expect(page.getByRole("heading", { name: "Consent screen" })).toBeVisible();
});

test("Sync now syncs every account", async ({ page, backend }) => {
  await page.goto("/calendar-overview/accounts");
  await page.getByRole("button", { name: "Synkronisér nu" }).click();
  await expect.poll(() => backend.calls.some((c) => c.name === "calendar-sync")).toBe(true);
});

test("removing an account asks first", async ({ page, backend }) => {
  await page.goto("/calendar-overview/accounts");
  await expect(page.getByText("mia@icloud.com", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fjern denne konto" }).first().click();
  await expect(page.getByText("Fjern mia@icloud.com?", { exact: false })).toBeVisible();
  expect(backend.calls.some((c) => c.name === "calendar-disconnect")).toBe(false);

  await page.getByRole("button", { name: "Fjern", exact: true }).click();
  await expect(page.getByText("mia@icloud.com", { exact: true })).toBeHidden();
  expect(backend.calls.find((c) => c.name === "calendar-disconnect")?.body).toEqual({
    connectionId: "conn-apple",
  });
});
