/**
 * The sign-in page. The iPhone app has no Google button (#91): with one, App
 * Store guideline 4.8 asks for another sign-in service beside it; without,
 * the app signs in only with Casy's own accounts. Fewer steps for a new person: #212.
 */
import { expect, test } from "./fixtures";

test.use({ signedIn: false });

test("the website offers Google beside email", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: "Fortsæt med Google" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
});

test("the iPhone app offers Apple and Casy's own sign-in, never Google", async ({ page }) => {
  // The bridge the app injects before the page runs (src/lib/nativeApp.ts).
  await page.addInitScript(() => {
    (window as unknown as { Capacitor: object }).Capacitor = { isNativePlatform: () => true };
  });
  await page.goto("/sign-in");
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fortsæt med Google" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Fortsæt med Apple" })).toBeVisible();
});

test("a new account takes one password field, which can be shown (#212)", async ({ page }) => {
  await page.goto("/sign-in?signup=1");
  await expect(page.getByLabel("Bekræft adgangskode")).toHaveCount(0);
  const field = page.getByLabel("Adgangskode", { exact: true });
  await field.fill("hemmelig123");
  await expect(field).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Vis adgangskode" }).click();
  await expect(field).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Skjul adgangskode" }).click();
  await expect(field).toHaveAttribute("type", "password");
});

test("Glemt adgangskode with no email asks for it there, with no error (#212)", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Glemt adgangskode?" }).click();
  const email = page.getByLabel(/^E-mail/);
  await expect(email).toBeFocused();
  await expect(page.getByText("Skriv din e-mail her")).toBeVisible();
  await email.fill("mig@eksempel.dk");
  await expect(page.getByText("Skriv din e-mail her")).toHaveCount(0);
});

test("a new account by email on a phone gives a name, which goes with it", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "a computer's sign-up stays as it was");
  const sent: { data?: { full_name?: string } }[] = [];
  await page.route("**/auth/v1/signup*", async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "new", email: "ny@example.com", identities: [{}] }),
    });
  });
  await page.goto("/sign-in?signup=1");
  await page.getByLabel("E-mail").fill("ny@example.com");
  const password = page.getByLabel("Adgangskode", { exact: true });
  await password.fill("Blaa-Hest-Springer-4471");
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText("Skriv dit navn")).toBeVisible();
  expect(sent).toHaveLength(0);

  await page.getByLabel("Dit navn").fill("Sara");
  await page.locator('button[type="submit"]').click();
  await expect.poll(() => sent[0]?.data?.full_name).toBe("Sara");
});

test("in the app, the reset email's link opens casy.app's sign-in page (#242)", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "the app is a phone");
  await page.addInitScript(() => {
    (window as unknown as { Capacitor: object }).Capacitor = { isNativePlatform: () => true };
  });
  const asked: string[] = [];
  await page.route("**/auth/v1/recover*", async (route) => {
    asked.push(new URL(route.request().url()).searchParams.get("redirect_to") ?? "");
    await route.fulfill({ status: 200, json: {} });
  });
  await page.goto("/sign-in");
  await page.getByLabel(/^E-mail/).fill("mig@eksempel.dk");
  await page.getByRole("button", { name: "Glemt adgangskode?" }).click();
  await expect.poll(() => asked.length).toBe(1);
  expect(asked[0]).toMatch(/^https:\/\/casy\.app\/sign-in\?/);
});
