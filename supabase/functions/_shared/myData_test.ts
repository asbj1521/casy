import { assertEquals } from "jsr:@std/assert@1";

import {
  credentialKind,
  shapeCalendars,
  shapeGroups,
  signInMethods,
  type ConnectionRow,
} from "./myData.ts";

Deno.test("a credential is named by kind, and only when one is stored", () => {
  assertEquals(credentialKind("google", true), "oauth");
  assertEquals(credentialKind("outlook", true), "oauth");
  assertEquals(credentialKind("apple", true), "password");
  assertEquals(credentialKind("ics", true), "link");
  assertEquals(credentialKind("google", false), null);
});

Deno.test("sign-in methods come from the login, each once, email last", () => {
  assertEquals(
    signInMethods({ id: "u", app_metadata: { providers: ["email", "google", "google"] } }),
    ["google", "email"],
  );
  assertEquals(signInMethods({ id: "u", app_metadata: { provider: "email" } }), ["email"]);
  assertEquals(signInMethods({ id: "u" }), []);
});

const connection = (overrides: Partial<ConnectionRow> = {}): ConnectionRow => ({
  provider: "apple",
  account_label: "me@icloud.com",
  status: "connected",
  created_at: "2026-09-01T10:00:00Z",
  last_synced_at: "2026-10-04T10:17:00Z",
  calendar_secrets: { connection_id: "c1" },
  calendar_sources: [
    {
      id: "s1",
      display_name: "Home",
      custom_name: null,
      purpose: "personal",
      priority: "normal",
      included: true,
      calendar_busy_cache: [{ count: 12 }],
    },
    {
      id: "s2",
      display_name: "Work",
      custom_name: "Job",
      purpose: "work",
      priority: "never",
      included: false,
      calendar_busy_cache: [],
    },
  ],
  ...overrides,
});

Deno.test("calendars carry their own busy counts and the credential's kind", () => {
  const [account] = shapeCalendars([connection()]);
  assertEquals(account.credential, "password");
  assertEquals(account.label, "me@icloud.com");
  assertEquals(
    account.calendars.map((c) => [c.name, c.customName, c.included, c.busyCount]),
    [
      ["Home", null, true, 12],
      ["Work", "Job", false, 0],
    ],
  );
});

Deno.test("a connection without a stored secret has no credential", () => {
  assertEquals(shapeCalendars([connection({ calendar_secrets: null })])[0].credential, null);
  assertEquals(shapeCalendars([connection({ calendar_secrets: [] })])[0].credential, null);
});

Deno.test("groups say how many are in them and whether you made them", () => {
  assertEquals(
    shapeGroups(
      [
        {
          joined_at: "2026-09-02T10:00:00Z",
          friend_groups: { name: "Team", created_by: "me", group_members: [{ count: 4 }] },
        },
        {
          joined_at: "2026-09-03T10:00:00Z",
          friend_groups: { name: "Friends", created_by: null, group_members: [{ count: 2 }] },
        },
        { joined_at: "2026-09-04T10:00:00Z", friend_groups: null },
      ],
      "me",
    ),
    [
      { name: "Team", members: 4, createdByYou: true, joinedAt: "2026-09-02T10:00:00Z" },
      { name: "Friends", members: 2, createdByYou: false, joinedAt: "2026-09-03T10:00:00Z" },
    ],
  );
});
