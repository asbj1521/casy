/**
 * Consent for Casy's AI to use content from a calendar (#120): asked once on
 * My calendar, changed any time in the profile, and shown in Your data.
 */
import { expect, test } from "./fixtures";

const ASK = "Lad Casys AI læse i din kalender?";
const ROW = "Lad Casys AI læse i din kalender";

test("My calendar asks once, and Allow saves the yes", async ({ page, backend }) => {
  backend.world.aiConsent = false;
  await page.goto("/calendar-overview");
  const ask = page.getByRole("dialog", { name: ASK });
  await expect(ask).toBeVisible();
  // Nothing is decided for the person: both answers are plain buttons.
  await expect(ask.getByRole("button", { name: "Ikke nu" })).toBeVisible();
  // The details live in the privacy policy, which opens on its AI section.
  await expect(ask.getByRole("link", { name: "privatlivspolitikken" })).toHaveAttribute(
    "href",
    "/privacy#ai",
  );

  await ask.getByRole("button", { name: "Tillad" }).click();
  await expect(ask).toBeHidden();
  expect(backend.world.aiConsent).toBe(true);
});

test("Not now closes it for good, and nothing is saved", async ({ page, backend }) => {
  backend.world.aiConsent = false;
  await page.goto("/calendar-overview");
  await page.getByRole("dialog", { name: ASK }).getByRole("button", { name: "Ikke nu" }).click();
  await expect(page.getByRole("dialog", { name: ASK })).toBeHidden();
  expect(backend.world.aiConsent).toBe(false);

  await page.reload();
  await expect(page.getByRole("button", { name: "Kalendere" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: ASK })).toHaveCount(0);
});

test("without AI switched on for them, nobody is asked and there is no switch", async ({
  page,
  backend,
}) => {
  backend.world.aiAllowed = false;
  backend.world.aiConsent = false;
  await page.goto("/calendar-overview");
  await expect(page.getByRole("dialog", { name: ASK })).toHaveCount(0);
  await page.goto("/profile/data");
  await expect(page.getByRole("heading", { name: "Din konto" })).toBeVisible();
  await expect(page.getByRole("switch", { name: ROW })).toHaveCount(0);
});

test("the profile itself has no switch; it lives in Your data", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("link", { name: "Dine data" })).toBeVisible();
  await expect(page.getByRole("switch", { name: ROW })).toHaveCount(0);
});

/** How far down the page an element is. */
const top = async (locator: import("@playwright/test").Locator) => (await locator.boundingBox())!.y;

test("while it is off the switch is first in Your data; on, it is a row of the AI list", async ({
  page,
  backend,
}) => {
  backend.world.aiConsent = false;
  await page.goto("/profile/data");
  const row = page.getByRole("switch", { name: ROW });
  const account = page.getByRole("heading", { name: "Din konto" });
  await expect(row).toHaveAttribute("aria-checked", "false");
  expect(await top(row)).toBeLessThan(await top(account));

  await row.click();
  await expect(row).toHaveAttribute("aria-checked", "true");
  expect(backend.world.aiConsent).toBe(true);
  // Now a row of the AI list, under the account, saying since when.
  const aiList = page.locator("section", {
    has: page.getByRole("heading", { name: "AI", exact: true }),
  });
  await expect(aiList.getByRole("switch", { name: ROW })).toBeVisible();
  await expect(aiList.getByText(/^Ja, siden /)).toBeVisible();
  expect(await top(row)).toBeGreaterThan(await top(account));
});

test("turning it off asks first, then the switch goes back to the top", async ({
  page,
  backend,
}) => {
  await page.goto("/profile/data");
  const row = page.getByRole("switch", { name: ROW });
  await expect(page.getByText(/^Ja, siden 1\. okt\. 2026$/)).toBeVisible();

  // Off asks first: it deletes the labels kept on the phone.
  await row.click();
  await expect(page.getByText(/mærkater, der er gemt på denne telefon/)).toBeVisible();
  expect(backend.world.aiConsent).toBe(true);
  await page.getByRole("button", { name: "Slå fra" }).click();
  await expect(row).toHaveAttribute("aria-checked", "false");
  expect(backend.world.aiConsent).toBe(false);
  expect(await top(row)).toBeLessThan(await top(page.getByRole("heading", { name: "Din konto" })));
});

test("the policy link opens the AI section", async ({ page }) => {
  await page.goto("/privacy#ai");
  await expect(page.getByRole("heading", { name: "AI i Casy" })).toBeInViewport();
});
