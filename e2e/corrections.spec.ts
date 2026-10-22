/**
 * Learning from use (#122): corrections of the AI sent to Casy for review.
 * On with the yes to the AI using your calendar, a switch of its own in Your
 * data, the sent ones listed there with a delete, and admin mode's list that
 * says what was sent and never by whom.
 */
import { expect, test } from "./fixtures";
import { NOW } from "./world";

const SWITCH = "Send mine rettelser til Casy";

const label = (importance: string) => ({
  kind: "exam",
  importance,
  prepDays: 3,
  avoidBefore: ["lateNight"],
  recoveryDays: 0,
  strain: "heavy",
  confidence: "high",
  reason: "",
});

const sent = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `corr-${i + 1}`,
    kind: "label" as const,
    data: {
      title: `Eksamen ${i + 1}`,
      calendar: "Uni",
      previous: label("normal"),
      note: "Det er en mundtlig eksamen",
      label: label("critical"),
    },
    createdAt: NOW,
  }));

test.describe("Your data", () => {
  test("sharing is on with the yes, and switches off without taking the yes back", async ({
    page,
    backend,
  }) => {
    await page.goto("/profile/data");
    const share = page.getByRole("switch", { name: SWITCH });
    await expect(share).toHaveAttribute("aria-checked", "true");

    await share.click();
    await expect(share).toHaveAttribute("aria-checked", "false");
    expect(backend.world.aiShare).toBe(false);
    // The AI itself is still on: only the sending stopped.
    expect(backend.world.aiConsent).toBe(true);
    await expect(
      page.getByRole("switch", { name: "Lad Casys AI læse i din kalender" }),
    ).toHaveAttribute("aria-checked", "true");

    await share.click();
    await expect(share).toHaveAttribute("aria-checked", "true");
    expect(backend.world.aiShare).toBe(true);
  });

  test("the sent corrections are counted, and can all be deleted", async ({ page, backend }) => {
    backend.world.corrections = sent(2);
    await page.goto("/profile/data");
    await expect(page.getByText("Rettelser sendt til Casy")).toBeVisible();
    const remove = page.getByRole("button", { name: "Slet mine sendte rettelser" });
    await expect(remove).toBeVisible();

    await remove.click();
    await expect(remove).toHaveCount(0);
    expect(backend.world.corrections).toEqual([]);
  });

  test("withdrawing the yes takes the sent corrections with it", async ({ page, backend }) => {
    backend.world.corrections = sent(3);
    await page.goto("/profile/data");
    await page.getByRole("switch", { name: "Lad Casys AI læse i din kalender" }).click();
    await page.getByRole("button", { name: "Slå fra" }).click();
    await expect.poll(() => backend.world.aiConsent).toBe(false);
    expect(backend.world.corrections).toEqual([]);
  });
});

test.describe("admin mode", () => {
  test("lists what was sent without saying whose, and handling one deletes it", async ({
    page,
    backend,
  }) => {
    backend.world.admin = "current";
    backend.world.corrections = sent(2);
    await page.goto("/profile?mode=admin");
    const card = page.getByRole("button", { name: /^Rettelser til AI'en/ });
    await expect(card).toHaveAttribute("aria-expanded", "false");
    await card.click();

    await expect(page.getByText("Eksamen 1")).toBeVisible();
    await expect(page.getByText(/Det er en mundtlig eksamen/).first()).toBeVisible();
    await expect(page.getByText(/AI'en sagde: .*Eksamen/).first()).toBeVisible();
    // Nothing says whose it is.
    await expect(page.getByText(ME_NAME)).toHaveCount(0);

    await page.getByRole("button", { name: "Håndteret" }).first().click();
    await expect(page.getByText("Eksamen 1")).toHaveCount(0);
    expect(backend.world.corrections).toHaveLength(1);
  });
});

const ME_NAME = "Mia Jensen";
