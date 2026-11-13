/** The browser tab names the page (useDocumentTitle), so tabs and the history can be told apart. */
import { expect, test } from "./fixtures";

test("each main page names itself in the tab", async ({ page, isMobile }) => {
  const pages: [string, string][] = [
    // A phone's events and profile are sheets on its home page (#169).
    ["/events", isMobile ? "Hjem · Vi finder lige en dag" : "Mine aftaler · Vi finder lige en dag"],
    // A phone's groups are a screen in the Profil sheet on its home page (#174).
    ["/groups", isMobile ? "Hjem · Vi finder lige en dag" : "Mine grupper · Vi finder lige en dag"],
    // A phone's My calendar is its home page (#169).
    [
      "/calendar-overview",
      isMobile ? "Hjem · Vi finder lige en dag" : "Min kalender · Vi finder lige en dag",
    ],
    ["/profile", isMobile ? "Hjem · Vi finder lige en dag" : "Profil · Vi finder lige en dag"],
  ];
  if (!isMobile) pages.push(["/", "Planlægning · Vi finder lige en dag"]);
  for (const [path, title] of pages) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
  }
});

test.describe("signed out", () => {
  test.use({ signedIn: false });

  test("the landing page is plain Casy, sign-in says so", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Vi finder lige en dag");
    await page.goto("/sign-in");
    await expect(page).toHaveTitle("Log ind · Vi finder lige en dag");
  });
});
