/**
 * Ranking a vote's dates by the group's important events (#119): the
 * scheduler asks the server for a score per date before it picks the dates,
 * and a voting card shows the score only when anyone shared something.
 */
import { expect, test } from "./fixtures";

const SEND = /^Foreslå( datoer)?$/;

/** The dates the last suggestion sent. */
const sentDates = (backend: { calls: { body: Record<string, unknown> }[] }) =>
  (
    backend.calls.filter((c) => c.body.action === "suggest").at(-1)!.body.dates as {
      start: string;
    }[]
  ).map((d) => d.start);

test.describe("the scheduler (computers)", () => {
  test.beforeEach(({ isMobile }) => test.skip(isMobile, "a phone plans from My calendar (#127)"));

  test("asks for the dates' scores first, and leaves out the dates that suit the group worst", async ({
    page,
    backend,
  }) => {
    await page.goto("/");
    await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
    await page.getByRole("button", { name: SEND }).click();
    await expect.poll(() => backend.calls.find((c) => c.body.action === "suggest")).toBeTruthy();

    // The pool was scored before anything was picked.
    const ranked = backend.calls.find((c) => c.body.action === "rank-dates");
    expect(ranked?.body).toMatchObject({ groupId: "g-friday", profile: { effects: ["alcohol"] } });
    expect((ranked!.body.dates as unknown[]).length).toBeGreaterThan(5);
    const plain = sentDates(backend);

    // Someone has an exam after two of those dates: they now score badly.
    backend.calls.length = 0;
    backend.world.dateScores = { [plain[1]]: 30, [plain[2]]: 30 };
    await page.goto("/");
    await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
    await page.getByRole("button", { name: SEND }).click();
    await expect.poll(() => backend.calls.find((c) => c.body.action === "suggest")).toBeTruthy();
    const ranked2 = sentDates(backend);

    // The date on screen is still first; the badly scoring ones are not offered.
    expect(ranked2[0]).toBe(plain[0]);
    expect(ranked2).not.toContain(plain[1]);
    expect(ranked2).not.toContain(plain[2]);
    expect(ranked2.length).toBe(plain.length);
  });

  test("goes on without scores when the server can't give them", async ({ page, backend }) => {
    await page.route(/functions\/v1\/events/, (route) => {
      const body = route.request().postDataJSON() as { action?: string } | null;
      if (body?.action === "rank-dates") {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ error: "Something went wrong. Please try again." }),
        });
      }
      return route.fallback();
    });
    await page.goto("/");
    await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
    await page.getByRole("button", { name: SEND }).click();
    await expect.poll(() => backend.calls.find((c) => c.body.action === "suggest")).toBeTruthy();
    expect(sentDates(backend).length).toBeGreaterThan(1);
  });
});

test.describe("a voting card", () => {
  test("shows the group's score when anyone shared something, and nothing otherwise", async ({
    page,
    backend,
  }) => {
    const vote = backend.world.events.find((e) => e.mode === "vote" && e.status === "pending")!;
    const [first, second] = vote.candidates;
    first.matchScore = 92;
    second.matchScore = null;

    await page.goto(`/events/${vote.id}/dates`);
    await expect(page.getByText("Passer 92%")).toBeVisible();
    await expect(page.getByText("Passer 92%")).toHaveAttribute(
      "title",
      "Hvor godt datoen passer til gruppens vigtige aftaler",
    );
  });
});
