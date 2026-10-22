/**
 * Tell Casy (#116): what is in no calendar, said or written, checked by the
 * person and only then kept. It then shows on My calendar and is deleted
 * again from the same sheet. Phone and computer alike.
 */
import { expect, test } from "./fixtures";

const OPEN = /^Fortæl Casy/;
const PLACEHOLDER = "Fx jeg rejser fra den 12. til den 19. oktober";

test("a description becomes entries, which are kept only when saved", async ({
  page,
  backend,
  isMobile,
}) => {
  await page.goto("/calendar-overview");
  await page.getByRole("button", { name: OPEN }).click();
  const sheet = page.getByRole("dialog", { name: "Fortæl Casy" });

  await sheet.getByRole("textbox", { name: PLACEHOLDER }).fill("Jeg rejser 12. til 19. oktober");
  await sheet.getByRole("button", { name: "Find tiderne" }).click();

  // Casy's reading is shown for checking; nothing is saved yet.
  await expect(sheet.getByText("Sådan forstod Casy det")).toBeVisible();
  await expect(sheet.getByText("Rejse")).toBeVisible();
  await expect(sheet.getByText(/12\. okt\. til .*19\. okt\./)).toBeVisible();
  expect(backend.world.entries).toHaveLength(0);
  const asked = backend.calls.find((c) => c.name === "entries-ai")!;
  expect(asked.body).toMatchObject({ text: "Jeg rejser 12. til 19. oktober", current: null });

  await sheet.getByRole("button", { name: "Gem 1 post" }).click();
  await expect(sheet.getByText("Det har du fortalt Casy")).toBeVisible();
  expect(backend.world.entries).toMatchObject([{ kind: "away", label: "Rejse", allDay: true }]);
  // Nothing of the sentence itself is stored.
  expect(JSON.stringify(backend.world.entries)).not.toContain("Jeg rejser");

  // It is on My calendar, in a calendar of its own named Casy.
  await sheet.getByRole("button", { name: "Færdig" }).click();
  await expect(sheet).toBeHidden();
  await page
    .getByRole("button", { name: isMobile ? "mandag 12. oktober" : /^man\. 12\. okt/ })
    .click();
  const day = isMobile
    ? page.getByRole("region", { name: "Mandag 12. oktober" })
    : page.getByRole("dialog", { name: "Mandag 12. oktober" });
  await expect(day.getByText("Rejse")).toBeVisible();
  await expect(day.getByText(/· Casy$/)).toBeVisible();
  await expect(day.getByText("Fortalt", { exact: true })).toBeVisible();
});

test("more details change the proposal, and a left out entry is not saved", async ({
  page,
  backend,
}) => {
  await page.goto("/calendar-overview");
  await page.getByRole("button", { name: OPEN }).click();
  const sheet = page.getByRole("dialog", { name: "Fortæl Casy" });
  await sheet.getByRole("textbox", { name: PLACEHOLDER }).fill("Jeg rejser 12. til 19. oktober");
  await sheet.getByRole("button", { name: "Find tiderne" }).click();
  await expect(sheet.getByText("Rejse")).toBeVisible();

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
  await expect(sheet.getByText("Det har du fortalt Casy")).toBeVisible();
  expect(backend.world.entries).toMatchObject([{ kind: "busy", label: "Kursus", allDay: false }]);
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
  const sheet = page.getByRole("dialog", { name: "Fortæl Casy" });
  await expect(sheet.getByText("Hjemme hos mine forældre")).toBeVisible();

  await sheet.getByRole("button", { name: "Slet Hjemme hos mine forældre" }).click();
  await expect(sheet.getByText("Det har du fortalt Casy")).toHaveCount(0);
  expect(backend.world.entries).toHaveLength(0);
});

test("text Casy can't use is said so, and the words come back to fix", async ({ page }) => {
  await page.goto("/calendar-overview");
  await page.getByRole("button", { name: OPEN }).click();
  const sheet = page.getByRole("dialog", { name: "Fortæl Casy" });
  await sheet.getByRole("textbox", { name: PLACEHOLDER }).fill("bare noget vrøvl");
  await sheet.getByRole("button", { name: "Find tiderne" }).click();
  await expect(sheet.getByText(/Casy kunne ikke få en kalenderpost ud af det/)).toBeVisible();
  await expect(sheet.getByRole("textbox", { name: PLACEHOLDER })).toHaveValue("bare noget vrøvl");
});

test("without AI switched on for them there is no way in", async ({ page, backend }) => {
  backend.world.aiAllowed = false;
  await page.goto("/calendar-overview");
  await expect(page.getByRole("button", { name: /Kalendere|Forrige måned/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: OPEN })).toHaveCount(0);
});
