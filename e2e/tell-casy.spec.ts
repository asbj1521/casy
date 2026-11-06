/**
 * Tilføj til kalender (#116, named so since #193): what is in no calendar,
 * said or written, checked by the person and only then kept. Kept, the sheet
 * closes; it then shows on My calendar and is deleted again from the same
 * sheet. Phone and computer alike.
 */
import { expect, test } from "./fixtures";

const OPEN = /^Tilføj til kalender/;
const PLACEHOLDER = "Fx jeg rejser fra den 12. til den 19. oktober";

test("a description becomes entries, which are kept only when saved", async ({
  page,
  backend,
  isMobile,
}) => {
  await page.goto("/calendar-overview");
  await page.getByRole("button", { name: OPEN }).click();
  const sheet = page.getByRole("dialog", { name: "Tilføj til kalender" });

  await sheet.getByRole("textbox", { name: PLACEHOLDER }).fill("Jeg rejser 12. til 19. oktober");
  await sheet.getByRole("button", { name: "Tilføj", exact: true }).click();

  // Casy's reading is shown for checking; nothing is saved yet.
  await expect(sheet.getByText("Sådan forstod Casy det")).toBeVisible();
  await expect(sheet.getByText("Rejse", { exact: true })).toBeVisible();
  await expect(sheet.getByText(/12\. okt\. til .*19\. okt\./)).toBeVisible();
  expect(backend.world.entries).toHaveLength(0);
  const asked = backend.calls.find((c) => c.name === "entries-ai")!;
  expect(asked.body).toMatchObject({ text: "Jeg rejser 12. til 19. oktober", current: null });

  // Kept, the sheet closes on it (#193).
  await sheet.getByRole("button", { name: "Gem 1 post" }).click();
  await expect(sheet).toBeHidden();
  expect(backend.world.entries).toMatchObject([{ kind: "away", label: "Rejse", allDay: true }]);
  // Nothing of the sentence itself is stored.
  expect(JSON.stringify(backend.world.entries)).not.toContain("Jeg rejser");

  // It is on My calendar, in a calendar of its own named Casy.
  await page
    .getByRole("button", { name: isMobile ? "mandag 12. oktober" : /^man\. 12\. okt/ })
    .click();
  // A phone's day view (#176) shows it across the day; a tap opens its details.
  if (isMobile) {
    const view = page.getByRole("region", { name: "Mandag 12. oktober" });
    await view.getByRole("button", { name: "Rejse" }).click();
  }
  const day = page.getByRole("dialog", { name: "Mandag 12. oktober" });
  await expect(day.getByText("Rejse")).toBeVisible();
  await expect(day.getByText(/· Casy$/)).toBeVisible();
  await expect(day.getByText("Tilføjet", { exact: true })).toBeVisible();
});

test("more details change the proposal, and a left out entry is not saved", async ({
  page,
  backend,
}) => {
  await page.goto("/calendar-overview");
  await page.getByRole("button", { name: OPEN }).click();
  const sheet = page.getByRole("dialog", { name: "Tilføj til kalender" });
  await sheet.getByRole("textbox", { name: PLACEHOLDER }).fill("Jeg rejser 12. til 19. oktober");
  await sheet.getByRole("button", { name: "Tilføj", exact: true }).click();
  await expect(sheet.getByText("Rejse", { exact: true })).toBeVisible();

  await sheet.getByRole("button", { name: "Tilføj detaljer" }).click();
  await sheet
    .getByRole("textbox", { name: "Tilføj detaljer, eller ret noget" })
    .fill("og et kursus torsdag aften");
  await sheet.getByRole("button", { name: "Opdater" }).click();

  // The second go refines the first: the proposal on screen goes along with the words.
  await expect(sheet.getByText("Kursus")).toBeVisible();
  const asked = backend.calls.filter((c) => c.name === "entries-ai");
  expect(asked).toHaveLength(2);
  expect(asked[1].body).toMatchObject({
    text: "og et kursus torsdag aften",
    earlier: ["Jeg rejser 12. til 19. oktober"],
    current: [{ label: "Rejse" }],
  });

  await sheet.getByRole("button", { name: "Drop Rejse" }).click();
  await sheet.getByRole("button", { name: "Gem 1 post" }).click();
  await expect(sheet).toBeHidden();
  expect(backend.world.entries).toMatchObject([{ kind: "busy", label: "Kursus", allDay: false }]);
  // Opened again: what was added is listed, to delete; the box is empty for the next.
  await page.getByRole("button", { name: OPEN }).click();
  await expect(sheet.getByText("Det har du tilføjet")).toBeVisible();
  await expect(sheet.getByText("Kursus")).toBeVisible();
  await expect(sheet.getByRole("textbox", { name: PLACEHOLDER })).toHaveValue("");
});

test("a kept entry is deleted from the same sheet", async ({ page, backend }) => {
  backend.world.entries = [
    {
      id: "entry-1",
      kind: "away",
      label: "Hjemme hos mine forældre",
      start: "2026-10-11T22:00:00.000Z",
      end: "2026-10-19T22:00:00.000Z",
      allDay: true,
    },
  ];
  await page.goto("/calendar-overview");
  await page.getByRole("button", { name: OPEN }).click();
  const sheet = page.getByRole("dialog", { name: "Tilføj til kalender" });
  await expect(sheet.getByText("Hjemme hos mine forældre")).toBeVisible();

  await sheet.getByRole("button", { name: "Slet Hjemme hos mine forældre" }).click();
  await expect(sheet.getByText("Det har du tilføjet")).toHaveCount(0);
  expect(backend.world.entries).toHaveLength(0);
});

test("text Casy can't use is said so, and the words come back to fix", async ({ page }) => {
  await page.goto("/calendar-overview");
  await page.getByRole("button", { name: OPEN }).click();
  const sheet = page.getByRole("dialog", { name: "Tilføj til kalender" });
  await sheet.getByRole("textbox", { name: PLACEHOLDER }).fill("bare noget vrøvl");
  await sheet.getByRole("button", { name: "Tilføj", exact: true }).click();
  await expect(sheet.getByText(/Casy kunne ikke få en kalenderpost ud af det/)).toBeVisible();
  await expect(sheet.getByRole("textbox", { name: PLACEHOLDER })).toHaveValue("bare noget vrøvl");
});

test("without a yes, sending asks first (#147)", async ({ page, backend }) => {
  backend.world.aiConsent = false;
  await page.goto("/calendar-overview");
  const ask = page.getByRole("dialog", { name: "Slå Casys AI til?" });
  // The home page's own question first, answered for good.
  await ask.getByRole("button", { name: "Ikke nu" }).click();
  await page.getByRole("button", { name: OPEN }).click();
  const sheet = page.getByRole("dialog", { name: "Tilføj til kalender" });
  await sheet.getByRole("textbox", { name: PLACEHOLDER }).fill("Væk hele december");
  await sheet.getByRole("button", { name: "Tilføj", exact: true }).click();
  await expect(ask).toBeVisible();
  expect(backend.calls.some((c) => c.name === "entries-ai")).toBe(false);
});

test("the speak button is a sound wave, and says Stop while listening (#106)", async ({ page }) => {
  await page.addInitScript(() => {
    // A browser that can listen, and does nothing when asked to.
    class Listener {
      start() {}
      stop() {}
      abort() {}
    }
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = Listener;
  });
  await page.goto("/calendar-overview");
  await page.getByRole("button", { name: OPEN }).click();
  const sheet = page.getByRole("dialog", { name: "Tilføj til kalender" });

  const speak = sheet.getByRole("button", { name: "Tal" });
  await expect(speak).toHaveAttribute("aria-pressed", "false");
  // Five bars, drawn for the eye only: the button's name is its label.
  await expect(speak.locator(".sound-wave-bar")).toHaveCount(5);

  await speak.click();
  const stop = sheet.getByRole("button", { name: "Stop" });
  await expect(stop).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.getByRole("textbox", { name: PLACEHOLDER })).toHaveAttribute(
    "placeholder",
    "Lytter…",
  );
  await stop.click();
  await expect(sheet.getByRole("button", { name: "Tal" })).toBeVisible();
});
