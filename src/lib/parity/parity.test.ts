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
import zoneFixture from "../../../ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/zone.json?raw";

import { type ParityCase, zoneCases } from "./zone.cases";

const FIXTURES = "ios/Packages/CasyCore/Tests/CasyCoreTests/Parity";

/** One case a line, so a changed rule reads as a short diff. */
function written(cases: ParityCase[]): string {
  return `[\n${cases.map((c) => JSON.stringify(c)).join(",\n")}\n]\n`;
}

describe.each([["zone", zoneCases(), zoneFixture]] as const)("%s", (module, cases, fixture) => {
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
