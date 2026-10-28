/** The browser tab names the page (useDocumentTitle), so tabs and the history can be told apart. */
import { expect, test } from "./fixtures";

test("each main page names itself in the tab", async ({ page, isMobile }) => {
  const pages: [string, string][] = [
    ["/events", "Mine aftaler · Casy"],
    ["/groups", "Mine grupper · Casy"],
    // A phone's My calendar is its home page (#169).
    ["/calendar-overview", isMobile ? "Hjem · Casy" : "Min kalender · Casy"],
    ["/profile", "Profil · Casy"],
  ];
  if (!isMobile) pages.push(["/", "Planlægning · Casy"]);
  for (const [path, title] of pages) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
  }
});

test.describe("signed out", () => {
  test.use({ signedIn: false });

  test("the landing page is plain Casy, sign-in says so", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Casy");
    await page.goto("/sign-in");
    await expect(page).toHaveTitle("Log ind · Casy");
  });
});
