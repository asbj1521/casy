/**
 * Keeps the Swift engine equal to this one (docs/native-ios-plan.md). Runs the
 * TypeScript over each module's cases and compares with the JSON the Swift
 * tests replay, so a rule changed here fails until the fixtures are written
 * again (UPDATE_PARITY=1 npx vitest run src/lib/parity), and then fails the
 * Swift tests until Swift is changed too.
 */
import { describe, expect, it } from "vitest";

// Read as text through Vite (?raw): the app's TypeScript settings have no
// Node types for node:fs.
import availabilityFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/availability.json?raw";
import eventSearchFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/eventSearch.json?raw";
import comfortFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/comfort.json?raw";
import candidatesFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/candidates.json?raw";
import widenFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/widen.json?raw";
import monthAvailabilityFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/monthAvailability.json?raw";
import shortcutsFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/shortcuts.json?raw";
import aiPlanFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/aiPlan.json?raw";
import earlyMorningFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/earlyMorning.json?raw";
import calendarsFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/calendars.json?raw";
import calendarDayFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/calendarDay.json?raw";
import eventsFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/events.json?raw";
import formatFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/format.json?raw";
import monthFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/month.json?raw";
import holidaysFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/holidays.json?raw";
import periodFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/period.json?raw";
import pictureCropFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/pictureCrop.json?raw";
import phoneBusyFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/phoneBusy.json?raw";
import paperPileFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/paperPile.json?raw";
import appLinksFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/appLinks.json?raw";
import appVersionFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/appVersion.json?raw";
import eventLabelsFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/eventLabels.json?raw";
import autoCategorizeFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/autoCategorize.json?raw";
import tripLegBookFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/tripLegBook.json?raw";
import primeDatesFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/primeDates.json?raw";
import tripsFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/trips.json?raw";
import zoneFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/zone.json?raw";

import { availabilityCases } from "./availability.cases";
import { calendarDayCases } from "./calendarDay.cases";
import { candidatesCases } from "./candidates.cases";
import { comfortCases } from "./comfort.cases";
import { monthAvailabilityCases } from "./monthAvailability.cases";
import { aiPlanCases } from "./aiPlan.cases";
import { earlyMorningCases } from "./earlyMorning.cases";
import { shortcutsCases } from "./shortcuts.cases";
import { widenCases } from "./widen.cases";
import { eventSearchCases } from "./eventSearch.cases";
import { calendarsCases } from "./calendars.cases";
import type { ParityCase } from "./cases";
import { eventsCases } from "./events.cases";
import { formatCases } from "./format.cases";
import { holidaysCases } from "./holidays.cases";
import { monthCases } from "./month.cases";
import { periodCases } from "./period.cases";
import { pictureCropCases } from "./pictureCrop.cases";
import { phoneBusyCases } from "./phoneBusy.cases";
import { zoneCases } from "./zone.cases";
import { paperPileCases } from "./paperPile.cases";
import { appLinksCases } from "./appLinks.cases";
import { appVersionCases } from "./appVersion.cases";
import { eventLabelsCases } from "./eventLabels.cases";
import { autoCategorizeCases } from "./autoCategorize.cases";
import { tripLegBookCases } from "./tripLegBook.cases";
import { primeDatesCases } from "./primeDates.cases";
import { tripsCases } from "./trips.cases";

const FIXTURES = "ios/Packages/CasyCore/Tests/CasyCoreTests/Parity";

/** One case a line, so a changed rule reads as a short diff. */
function written(cases: ParityCase[]): string {
  return `[\n${cases.map((c) => JSON.stringify(c)).join(",\n")}\n]\n`;
}

describe.each([
  ["zone", zoneCases(), zoneFixture],
  ["format", formatCases(), formatFixture],
  ["holidays", holidaysCases(), holidaysFixture],
  ["period", periodCases(), periodFixture],
  ["phoneBusy", phoneBusyCases(), phoneBusyFixture],
  ["events", eventsCases(), eventsFixture],
  ["pictureCrop", pictureCropCases(), pictureCropFixture],
  ["calendarDay", calendarDayCases(), calendarDayFixture],
  ["calendars", calendarsCases(), calendarsFixture],
  ["month", monthCases(), monthFixture],
  ["availability", availabilityCases(), availabilityFixture],
  ["eventSearch", eventSearchCases(), eventSearchFixture],
  ["comfort", comfortCases(), comfortFixture],
  ["candidates", candidatesCases(), candidatesFixture],
  ["widen", widenCases(), widenFixture],
  ["monthAvailability", monthAvailabilityCases(), monthAvailabilityFixture],
  ["shortcuts", shortcutsCases(), shortcutsFixture],
  ["aiPlan", aiPlanCases(), aiPlanFixture],
  ["earlyMorning", earlyMorningCases(), earlyMorningFixture],
  ["paperPile", paperPileCases(), paperPileFixture],
  ["appLinks", appLinksCases(), appLinksFixture],
  ["appVersion", appVersionCases(), appVersionFixture],
  ["eventLabels", eventLabelsCases(), eventLabelsFixture],
  ["autoCategorize", autoCategorizeCases(), autoCategorizeFixture],
  ["tripLegBook", tripLegBookCases(), tripLegBookFixture],
  ["primeDates", primeDatesCases(), primeDatesFixture],
  ["trips", tripsCases(), tripsFixture],
] as const)("%s", (module, cases, fixture) => {
  it.runIf(import.meta.env.UPDATE_PARITY)("writes the fixtures", async () => {
    // Named through a variable so the type check doesn't look for Node's types.
    const fsModule: string = "node:fs";
    const fs = (await import(/* @vite-ignore */ fsModule)) as {
      writeFileSync: (path: string, text: string) => void;
    };
    fs.writeFileSync(`${FIXTURES}/${module}.json`, written(cases));
  });

  it.skipIf(import.meta.env.UPDATE_PARITY)("answers as the fixtures the Swift tests replay", () => {
    expect(written(cases) === fixture).toBe(true);
  });

  it("has every case named once", () => {
    expect(new Set(cases.map((c) => c.name)).size).toBe(cases.length);
  });
});
