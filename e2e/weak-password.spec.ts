/** The note about a password found in a leak (#147): on a phone it floats clear of the header. */
import { expect, test } from "./fixtures";
import { ME } from "./world";

test("on a phone the note is on screen, above the header, and closes for good", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "a computer keeps its bar above the page");
  await page.addInitScript((id) => sessionStorage.setItem("casy-weak-password", id), ME.id);
  await page.goto("/calendar-overview");
  const note = page.getByText("Din adgangskode er nemmere at gætte");
  await expect(note).toBeVisible();
  const close = page.getByRole("button", { name: "Luk" });
  // Nothing covers it: the close button is what a tap there hits.
  await close.click({ trial: true, timeout: 3000 });
  await close.click();
  await expect(note).toHaveCount(0);
});
