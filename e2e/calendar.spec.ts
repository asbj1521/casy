/** My calendar on a computer (#104): a Mac's month view, a day's busy time in a popover. */
import { expect, test } from "./fixtures";

test.beforeEach(({ isMobile }) => test.skip(isMobile, "computers only"));

test("a day opens in a popover beside it, and the month turns", async ({ page }) => {
  await page.goto("/calendar-overview");
  await expect(page.getByRole("heading", { name: "Oktober 2026" })).toBeVisible();

  await page.getByRole("button", { name: /^ons\. 14\. okt/ }).click();
  const day = page.getByRole("dialog", { name: "Onsdag 14. oktober" });
  await expect(day).toBeVisible();
  await expect(day.getByText("08:30-16:00")).toBeVisible();

  // Another day moves it there; Esc closes it.
  await page.getByRole("button", { name: /^lør\. 31\. okt/ }).click();
  await expect(page.getByRole("dialog", { name: "Lørdag 31. oktober" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // A month at a time, and back to today.
  await page.getByRole("button", { name: "Næste måned" }).click();
  await expect(page.getByRole("heading", { name: "November 2026" })).toBeVisible();
  await page.getByRole("button", { name: "I dag" }).click();
  await expect(page.getByRole("heading", { name: "Oktober 2026" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Forrige måned" })).toBeDisabled();
});

test("a calendar nobody has sorted gets a category by AI, marked until one is picked (#118)", async ({
  page,
  backend,
}) => {
  const family = backend.world.connections
    .flatMap((c) => c.calendar_sources)
    .find((s) => s.id === "cal-family")!;
  family.purpose_source = null;

  await page.goto("/calendar-overview");
  await page.getByRole("button", { name: /^Apple · mia@icloud\.com/ }).click();
  const category = page.getByRole("combobox", { name: /Kategori for Familie/ });
  await expect(category).toHaveValue("school");
  await expect(category).toHaveAccessibleName("Kategori for Familie, gættet");

  // Picked by hand: the mark goes, and the AI is never asked about it again.
  await category.selectOption("personal");
  await expect(category).toHaveAccessibleName("Kategori for Familie");
  expect(family).toMatchObject({ purpose: "personal", purpose_source: "user" });
  expect(backend.calls.filter((c) => c.name === "calendar-categorize")).toHaveLength(1);
});
