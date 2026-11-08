/**
 * The fake backend's answers, for the Swift decoders (CasyAPI's AnswersTests;
 * docs/native-ios-plan.md). The fake is typed with src/api's types, so a change
 * to an answer's shape fails here until the files are written again
 * (UPDATE_PARITY=1 npx vitest run e2e/apiAnswers), and then fails the Swift
 * decoders until they are changed too. Run by Vitest, not Playwright.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

import { FakeBackend } from "./backend";
import { DEFAULT_WORLD, makeWorld, type WorldOptions } from "./world";

const ANSWERS = resolve(process.cwd(), "ios/Packages/CasyAPI/Tests/CasyAPITests/Answers");
const EMPTY: WorldOptions = { calendars: "none", groups: "none" };

const ASKED: [file: string, world: WorldOptions, fn: string, body: Record<string, unknown>][] = [
  ["whoami", DEFAULT_WORLD, "groups", { action: "whoami" }],
  ["groups-list", DEFAULT_WORLD, "groups", { action: "list" }],
  ["groups-list-empty", EMPTY, "groups", { action: "list" }],
  ["groups-invitations", DEFAULT_WORLD, "groups", { action: "invitations" }],
  ["account-data", DEFAULT_WORLD, "account", { action: "data" }],
  ["account-data-empty", EMPTY, "account", { action: "data" }],
  ["account-delete", DEFAULT_WORLD, "account", { action: "delete", confirm: true }],
  ["admin-status", DEFAULT_WORLD, "admin", { action: "status" }],
];

describe.each(ASKED)("%s", (file, world, name, body) => {
  const answer = new FakeBackend(makeWorld(world)).answer({
    name,
    params: new URLSearchParams(),
    body,
  });
  const text = `${JSON.stringify(answer.json, null, 2)}\n`;
  const path = resolve(ANSWERS, `${file}.json`);

  it("is an answer the backend gives", () => {
    expect(answer.status).toBe(200);
  });

  it.runIf(process.env.UPDATE_PARITY)("is written", () => {
    writeFileSync(path, text);
  });

  it.skipIf(process.env.UPDATE_PARITY)("matches what the Swift decoders read", () => {
    expect(readFileSync(path, "utf8") === text).toBe(true);
  });
});
