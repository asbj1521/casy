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
import { DEFAULT_WORLD, makeWorld, type World, type WorldOptions } from "./world";

const ANSWERS = resolve(process.cwd(), "ios/Packages/CasyAPI/Tests/CasyAPITests/Answers");
const EMPTY: WorldOptions = { calendars: "none", groups: "none" };

/** Mia as an admin, for admin mode's answers. */
const asAdmin = (w: World) => {
  w.admin = "current";
};

const ASKED: [
  file: string,
  world: WorldOptions,
  fn: string,
  body: Record<string, unknown>,
  setup?: (w: World) => void,
][] = [
  ["whoami", DEFAULT_WORLD, "groups", { action: "whoami" }],
  ["groups-list", DEFAULT_WORLD, "groups", { action: "list" }],
  ["groups-list-empty", EMPTY, "groups", { action: "list" }],
  ["groups-invitations", DEFAULT_WORLD, "groups", { action: "invitations" }],
  [
    "groups-accept-invitation",
    DEFAULT_WORLD,
    "groups",
    { action: "accept-invitation", groupId: "g-badminton" },
  ],
  [
    "groups-decline-invitation",
    DEFAULT_WORLD,
    "groups",
    { action: "decline-invitation", groupId: "g-badminton" },
  ],
  ["groups-block", DEFAULT_WORLD, "groups", { action: "block", invitationGroupId: "g-badminton" }],
  ["groups-leave", DEFAULT_WORLD, "groups", { action: "leave", groupId: "g-running" }],
  ["groups-friends", DEFAULT_WORLD, "groups", { action: "friends" }],
  ["groups-friend-link", DEFAULT_WORLD, "groups", { action: "friend-link", app: true }],
  ["groups-remove-friend", DEFAULT_WORLD, "groups", { action: "remove-friend", profileId: "p-x" }],
  ["groups-invite", DEFAULT_WORLD, "groups", { action: "invite", groupId: "g-friday", app: true }],
  [
    "groups-invite-members",
    DEFAULT_WORLD,
    "groups",
    { action: "invite-members", groupId: "g-running", profileIds: ["p-jonas"], emails: [] },
  ],
  ["groups-create", DEFAULT_WORLD, "groups", { action: "create", name: "Brætspil" }],
  [
    "groups-rename",
    DEFAULT_WORLD,
    "groups",
    { action: "rename", groupId: "g-friday", name: "Fredag" },
  ],
  [
    "groups-describe",
    DEFAULT_WORLD,
    "groups",
    { action: "describe", groupId: "g-friday", description: "Øl" },
  ],
  [
    "groups-set-prime-dates",
    DEFAULT_WORLD,
    "groups",
    { action: "set-prime-dates", groupId: "g-friday", on: false },
  ],
  [
    "groups-report",
    DEFAULT_WORLD,
    "groups",
    {
      action: "report",
      kind: "member",
      groupId: "g-friday",
      memberId: "p-jonas",
      reason: "spam",
      note: "",
    },
  ],
  ["groups-block-member", DEFAULT_WORLD, "groups", { action: "block", profileId: "p-jonas" }],
  [
    "pictures-set-group-picture",
    DEFAULT_WORLD,
    "pictures",
    { action: "set-group-picture", groupId: "g-friday", image: "/9j/AAAA" },
  ],
  [
    "pictures-remove-group-picture",
    DEFAULT_WORLD,
    "pictures",
    { action: "remove-group-picture", groupId: "g-friday" },
  ],
  ["groups-delete", DEFAULT_WORLD, "groups", { action: "delete", groupId: "g-friday" }],
  ["account-data", DEFAULT_WORLD, "account", { action: "data" }],
  ["account-data-empty", EMPTY, "account", { action: "data" }],
  ["account-delete", DEFAULT_WORLD, "account", { action: "delete", confirm: true }],
  ["account-push-settings", DEFAULT_WORLD, "account", { action: "push-settings" }],
  [
    "account-push-set",
    DEFAULT_WORLD,
    "account",
    { action: "push-set", kind: "deadline_near", on: false },
  ],
  ["admin-status", DEFAULT_WORLD, "admin", { action: "status" }],
  ["admin-overview", DEFAULT_WORLD, "admin", { action: "overview" }, asAdmin],
  ["account-export", DEFAULT_WORLD, "account", { action: "export" }],
  ["account-ai-consent", DEFAULT_WORLD, "account", { action: "ai-consent", on: false }],
  ["account-corrections-delete", DEFAULT_WORLD, "account", { action: "corrections-delete" }],
  ["groups-blocked", DEFAULT_WORLD, "groups", { action: "blocked" }],
  ["groups-unblock", DEFAULT_WORLD, "groups", { action: "unblock", profileId: "p-x" }],
];

describe.each(ASKED)("%s", (file, options, name, body, setup) => {
  const world = makeWorld(options);
  setup?.(world);
  const answer = new FakeBackend(world).answer({
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
