/** The page an invite link lands on (#211): what a friend who has never heard of Casy sees first. */
import { expect, test } from "./fixtures";

test.describe("signed out", () => {
  test.use({ signedIn: false });

  test("says who invited you, to what, and what Casy is, before asking for an account", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/join/a-token");
    await expect(page.getByRole("heading", { name: "Sara har inviteret dig til" })).toBeVisible();
    await expect(page.getByText("Sommerhuset")).toBeVisible();
    await expect(page.getByText("4 medlemmer indtil videre")).toBeVisible();
    await expect(page.getByText(/^Vi finder de datoer/)).toBeVisible();

    await page
      .getByRole("link", { name: isMobile ? "Bliv medlem" : "Log ind for at blive medlem" })
      .click();
    // A phone says yes first, so it signs up and comes back to join (#224).
    await expect(page).toHaveURL(
      isMobile
        ? /\/sign-in\?signup=1&next=%2Fjoin%2Fa-token%3Fjoin%3D1/
        : /\/sign-in\?next=%2Fjoin%2Fa-token/,
    );
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
    await expect(page.getByText(/^We find the dates/)).toBeVisible();
  });

  test("a browser that is no iPhone has no way to the App Store", async ({ page }) => {
    await page.goto("/join/a-token");
    await expect(page.getByRole("heading", { name: "Sara har inviteret dig til" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Hent appen" })).toHaveCount(0);
  });

  test.describe("on an iPhone", () => {
    test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) Safari/604.1" });

    test("the App Store is the one way on, in both languages (#277)", async ({
      page,
      isMobile,
    }) => {
      test.skip(!isMobile, "a computer keeps its card");
      await page.goto("/join/a-token");
      await expect(page.getByRole("link", { name: "Hent i App Store" })).toHaveAttribute(
        "href",
        "https://apps.apple.com/app/id6830713238",
      );
      await expect(
        page.getByText("Hent appen, og log ind. Så venter gruppen på dig."),
      ).toBeVisible();
      // The profile is made in the app: no joining here, and no other way into it.
      await expect(page.getByRole("link", { name: "Bliv medlem" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Åbn i appen" })).toHaveCount(0);
      await page.goto("/join/a-token?lang=en");
      await expect(page.getByRole("link", { name: "Get it on the App Store" })).toBeVisible();
    });

    test("Bruger du Android? shows the browser's way of joining (#277)", async ({
      page,
      isMobile,
    }) => {
      test.skip(!isMobile, "a computer keeps its card");
      await page.goto("/join/a-token");
      await page.getByRole("button", { name: "Bruger du Android?" }).click();
      await expect(page.getByRole("link", { name: "Bliv medlem" })).toHaveAttribute(
        "href",
        "/sign-in?signup=1&next=%2Fjoin%2Fa-token%3Fjoin%3D1",
      );
    });

    test("the door page has one way on, back to casy.app and so into any app (#257)", async ({
      page,
      isMobile,
    }) => {
      test.skip(!isMobile, "a computer keeps its card");
      await page.goto("/join/a-token?door=1");
      await expect(page.getByText("Sommerhuset")).toBeVisible();
      await expect(page.getByRole("link", { name: "Åbn i appen" })).toHaveAttribute(
        "href",
        "https://casy.app/join/a-token?noapp=1",
      );
      await expect(page.getByRole("link", { name: "Fortsæt i browseren" })).toHaveAttribute(
        "href",
        "https://casy.app/join/a-token",
      );
      await expect(page.getByRole("link", { name: "Bliv medlem" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Hent appen" })).toHaveCount(0);
    });

    test("back from the door with no app, the App Store is still the way on (#257, #277)", async ({
      page,
      isMobile,
    }) => {
      test.skip(!isMobile, "a computer keeps its card");
      await page.goto("/join/a-token?noapp=1");
      await expect(page.getByRole("link", { name: "Hent i App Store" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Åbn i appen" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Bliv medlem" })).toHaveCount(0);
    });

    test("Hent i App Store copies the invite's link on the way, for the app to be handed (#237)", async ({
      page,
      isMobile,
    }) => {
      test.skip(!isMobile, "a computer keeps its card");
      await page.addInitScript(() => {
        const w = window as unknown as { copied: string[] };
        w.copied = [];
        Object.defineProperty(navigator, "clipboard", {
          value: { writeText: (text: string) => (w.copied.push(text), Promise.resolve()) },
        });
        // The App Store is not for a test to visit.
        document.addEventListener("click", (e) => e.preventDefault(), true);
      });
      await page.goto("/join/a-token");
      await page.getByRole("link", { name: "Hent i App Store" }).click();
      expect(await page.evaluate(() => (window as unknown as { copied: string[] }).copied)).toEqual(
        ["https://casy.app/join/a-token"],
      );
    });

    test("the app itself does not", async ({ page, isMobile }) => {
      test.skip(!isMobile, "the app is a phone");
      await page.addInitScript(() => {
        (window as unknown as { Capacitor: object }).Capacitor = { isNativePlatform: () => true };
      });
      await page.goto("/join/a-token");
      await expect(page.getByRole("link", { name: "Bliv medlem" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Hent appen" })).toHaveCount(0);
    });
  });
});

test.describe("in a chat app's own browser", () => {
  test.use({
    signedIn: false,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) Mobile/15E148 [FBAN/MessengerLiteForiOS;FBAV/480.0]",
  });

  test("Messenger's own browser gets the App Store too, and nothing else (#277)", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "a computer keeps its card");
    await page.goto("/join/a-token");
    await expect(page.getByRole("link", { name: "Hent i App Store" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Bliv medlem" })).toHaveCount(0);
  });
});

test("signed in, one press joins, with no word on what Casy is", async ({ page, backend }) => {
  await page.goto("/join/a-token");
  await expect(page.getByRole("heading", { name: "Sara har inviteret dig til" })).toBeVisible();
  await expect(page.getByText(/^Vi finder de datoer/)).toHaveCount(0);
  await page.getByRole("button", { name: "Bliv medlem" }).click();
  await expect.poll(() => backend.calls.find((c) => c.body.action === "join")).toBeTruthy();
  await expect(page).toHaveURL(/\/$/);
});

test("a phone's invite shows the picture, and keeps the small print behind the ? (#224)", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "a computer keeps its card");
  await page.goto("/join/picture-token");
  await expect(page.locator("main img")).toBeVisible();
  await expect(page.getByText(/^Medlemmer kan se/)).toHaveCount(0);
  await page.getByRole("button", { name: "Om invitationen" }).click();
  await expect(
    page.getByRole("dialog", { name: "Om invitationen" }).getByText(/^Medlemmer kan se/),
  ).toBeVisible();
});

test("back from signing up on a phone, the yes already given joins the group (#224)", async ({
  page,
  backend,
  isMobile,
}) => {
  test.skip(!isMobile, "a computer signs in first and answers after");
  await page.goto("/join/a-token?join=1");
  await expect.poll(() => backend.calls.filter((c) => c.body.action === "join").length).toBe(1);
  await expect(page).toHaveURL(/\/$/);
});

test("a member's own link waits for their groups, then says they are in and leads to the group (#244)", async ({
  page,
  backend,
  isMobile,
}) => {
  test.skip(!isMobile, "a computer keeps its card");
  // Already in the group the link is for.
  backend.world.groups.push({ ...backend.world.groups[0], id: "g-invited", name: "Sommerhuset" });
  // Their groups come slowly, as on a fresh phone: until then nothing is offered.
  // A page opening asks through "start" (#158), so that is held as well as "list".
  await page.route("**/functions/v1/groups?*", async (route) => {
    if (!["list", "start"].includes(route.request().postDataJSON()?.action)) {
      return route.fallback();
    }
    await new Promise((done) => setTimeout(done, 1200));
    await route.fallback();
  });
  await page.goto("/join/a-token");
  await expect(page.getByText("Åbner invitationen…")).toBeVisible();
  await expect(page.getByRole("link", { name: "Bliv medlem" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Bliv medlem" })).toHaveCount(0);

  await expect(page.getByText("Du er allerede med i gruppen.")).toBeVisible();
  await page.getByRole("link", { name: "Gå til gruppen" }).click();
  await expect(page).toHaveURL(/\?profile=groups\/g-invited$/);
});
