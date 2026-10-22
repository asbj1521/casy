/**
 * Learning from use (#122): corrections of the AI sent to Casy for review.
 * On with the yes to the AI using your calendar, a switch of its own in Your
 * data, the sent ones listed there with a delete, and admin mode's list that
 * says what was sent and never by whom.
 */
import type { Page } from "@playwright/test";

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

/** Picks `label` on the wheel a settings button opens, and checks it took. */
async function pickOnWheel(page: Page, current: string, label: string) {
  await page.getByRole("button", { name: current, exact: true }).filter({ visible: true }).click();
  await page.getByText(label, { exact: true }).filter({ visible: true }).nth(7).click();
  await expect(page.getByRole("button", { name: label, exact: true }).first()).toBeVisible();
  await page.keyboard.press("Escape");
}

test.describe("Planlæg med AI (computers)", () => {
  test.beforeEach(({ isMobile }) => test.skip(isMobile, "a phone plans from My calendar (#127)"));

  /** Describes a dinner; the AI answers with a guessed 18:00 and a question about the time. */
  async function describe(page: Page) {
    await page.goto("/");
    await expect(page.getByText("Onsdag 7. oktober").first()).toBeVisible();
    await page.getByRole("button", { name: "Planlæg med AI" }).click();
    const box = page.getByRole("textbox", { name: /Fx middag en fredag/ });
    await box.fill("Middag en fredag i november uden Jonas");
    await box.press("Enter");
    await expect(page.getByText("Hvornår på aftenen?")).toBeVisible();
  }

  test("a plan sent as it was counts as right: nothing overridden", async ({ page, backend }) => {
    await describe(page);
    await page.getByRole("button", { name: "Indstillinger", exact: true }).click();
    await page.getByRole("button", { name: /^Foreslå( datoer)?$/ }).click();

    await expect.poll(() => backend.world.corrections.length).toBe(1);
    const [sentPlan] = backend.world.corrections;
    expect(sentPlan.kind).toBe("plan");
    expect(sentPlan.data).toMatchObject({
      texts: ["Middag en fredag i november uden Jonas"],
      overridden: [],
      plan: { kind: "meeting", startHour: 18, assumed: ["startHour"] },
      final: { kind: "meeting", startHour: 18 },
    });
    // The people the AI named, and its questions, never go along: only the person's own words.
    expect((sentPlan.data as { plan: object }).plan).not.toHaveProperty("people");
  });

  test("a guess the person changed by hand is what Casy learns from", async ({ page, backend }) => {
    await describe(page);
    await page.getByRole("button", { name: "Indstillinger", exact: true }).click();
    await page.getByRole("tab", { name: "Tidspunkt" }).click();
    await pickOnWheel(page, "18:00", "19:00");
    await page.getByRole("button", { name: /^Foreslå( datoer)?$/ }).click();

    await expect.poll(() => backend.world.corrections.length).toBe(1);
    expect(backend.world.corrections[0].data).toMatchObject({
      overridden: ["startHour"],
      plan: { startHour: 18 },
      final: { startHour: 19 },
    });
  });

  test("with sharing switched off nothing is sent", async ({ page, backend }) => {
    backend.world.aiShare = false;
    await describe(page);
    await page.getByRole("button", { name: "Indstillinger", exact: true }).click();
    await page.getByRole("button", { name: /^Foreslå( datoer)?$/ }).click();
    await expect.poll(() => backend.calls.find((c) => c.body.action === "suggest")).toBeTruthy();
    expect(backend.calls.filter((c) => c.name === "ai-feedback")).toHaveLength(0);
    expect(backend.world.corrections).toEqual([]);
  });
});
