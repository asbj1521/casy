/**
 * The share link, /app (#270, #271). On an iPhone it jumps to the App Store,
 * but the browsers inside Messenger and the like refuse a jump no tap asked
 * for: the page itself then shows the way there, never an empty page.
 */
import { expect, test } from "./fixtures";

test.use({
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) [FBAN/MessengerForiOS]",
});

test("an iPhone whose browser stays put still gets a button to the App Store", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "the share link is for phones");
  // Messenger's browser: the jump to the App Store goes nowhere (a 204 leaves the page as it is).
  await page.route("https://apps.apple.com/**", (route) => route.fulfill({ status: 204 }));
  await page.goto("/app");
  await expect(page.getByRole("link", { name: "Hent i App Store" })).toHaveAttribute(
    "href",
    "https://apps.apple.com/app/id6830713238",
  );
  await expect(page.getByRole("heading", { name: "Vi finder lige en dag" })).toBeVisible();
});
