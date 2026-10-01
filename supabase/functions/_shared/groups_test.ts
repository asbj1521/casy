// Run with: deno test --node-modules-dir=none --allow-all supabase/functions/_shared/
import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import { HttpError } from "./http.ts";
import {
  cleanDisplayName,
  cleanGroupName,
  displayNameFor,
  inviteUrl,
  looksLikeInviteToken,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_EMAILS_PER_REQUEST,
  MAX_GROUP_NAME_LENGTH,
  MAX_PICKED_PER_REQUEST,
  newInviteToken,
  normalizeEmail,
  readInvitees,
} from "./groups.ts";

Deno.test("an invite token survives a URL and is never repeated", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const token = newInviteToken();
    assert(looksLikeInviteToken(token), `${token} is not token-shaped`);
    assertEquals(encodeURIComponent(token), token, "token must need no escaping");
    assert(!seen.has(token), "tokens must not repeat");
    seen.add(token);
  }
});

Deno.test("junk is rejected before the database is asked", () => {
  assertEquals(looksLikeInviteToken(""), false);
  assertEquals(looksLikeInviteToken("short"), false);
  assertEquals(looksLikeInviteToken(`a+/=${"x".repeat(40)}`), false);
  assertEquals(looksLikeInviteToken(null), false);
  assertEquals(looksLikeInviteToken(42), false);
});

Deno.test("the invite link points at the join page", () => {
  assertEquals(
    inviteUrl("https://casy-red.vercel.app", "abc123"),
    "https://casy-red.vercel.app/join/abc123",
  );
});

Deno.test("group names are tidied, capped and never left blank", () => {
  assertEquals(cleanGroupName("  Ikke Almene HA'ere  "), "Ikke Almene HA'ere");
  assertEquals(cleanGroupName("Two\nlines\tand\u0000nulls"), "Twolinesandnulls");
  assertEquals(cleanGroupName("   "), null);
  assertEquals(cleanGroupName(""), null);
  assertEquals(cleanGroupName(null), null);
  assertEquals(cleanGroupName(12), null);
});

Deno.test("a long name is cut to the limit without a trailing space", () => {
  const name = cleanGroupName(`${"a".repeat(MAX_GROUP_NAME_LENGTH - 1)} bbbb`);
  assertEquals(name, "a".repeat(MAX_GROUP_NAME_LENGTH - 1));
  assertEquals(name!.length <= MAX_GROUP_NAME_LENGTH, true);
});

Deno.test("a chosen display name is tidied, capped and never left blank", () => {
  assertEquals(cleanDisplayName("  Simon  "), "Simon");
  assertEquals(cleanDisplayName("Two\nlines\tand\u0000nulls"), "Twolinesandnulls");
  assertEquals(cleanDisplayName("   "), null);
  assertEquals(cleanDisplayName(""), null);
  assertEquals(cleanDisplayName(null), null);
  assertEquals(cleanDisplayName(12), null);
  const long = cleanDisplayName(`${"a".repeat(MAX_DISPLAY_NAME_LENGTH - 1)} bbbb`);
  assertEquals(long, "a".repeat(MAX_DISPLAY_NAME_LENGTH - 1));
});

Deno.test("members are named, and never by their email address", () => {
  assertEquals(
    displayNameFor({ email: "simon@example.com", user_metadata: { full_name: "Simon Liocouras" } }),
    "Simon Liocouras",
  );
  assertEquals(displayNameFor({ email: "x@y.dk", user_metadata: { name: "Thue" } }), "Thue");
  // No name at all: the local part stands in, so the domain stays private.
  assertEquals(displayNameFor({ email: "kristoffer@somebank.dk" }), "kristoffer");
  assertEquals(displayNameFor({ email: null, user_metadata: null }), "Someone");
  assertEquals(displayNameFor(null), "Someone");
  // A blank name in the metadata must not win over the email.
  assertEquals(
    displayNameFor({ email: "jonas@example.com", user_metadata: { full_name: "  " } }),
    "jonas",
  );
});

const ID = "0b8e6f1e-2a4c-4d7b-9a51-6c3f0e2d1a90";

Deno.test("an email is matched the way accounts store it", () => {
  assertEquals(normalizeEmail("  Anna@Example.DK "), "anna@example.dk");
  assertEquals(normalizeEmail("anna"), null);
  assertEquals(normalizeEmail("anna@example"), null);
  assertEquals(normalizeEmail("an na@example.dk"), null);
  assertEquals(normalizeEmail(42), null);
});

Deno.test("invitees are optional, and repeats count once", () => {
  assertEquals(readInvitees({}), { profileIds: [], emails: [] });
  assertEquals(
    readInvitees({ profileIds: [ID, ID.toUpperCase()], emails: ["A@b.dk", "a@b.dk "] }),
    { profileIds: [ID], emails: ["a@b.dk"] },
  );
});

Deno.test("one bad invitee refuses the whole request", () => {
  assertThrows(() => readInvitees({ profileIds: ["not-an-id"] }), HttpError);
  assertThrows(() => readInvitees({ profileIds: ID }), HttpError);
  assertThrows(
    () => readInvitees({ emails: ["a@b.dk", "nope"] }),
    HttpError,
    "That is not an email address.",
  );
});

Deno.test("a request can't invite more than a group could hold", () => {
  const ids = Array.from(
    { length: MAX_PICKED_PER_REQUEST + 1 },
    (_, i) => `0b8e6f1e-2a4c-4d7b-9a51-${String(i).padStart(12, "0")}`,
  );
  assertThrows(() => readInvitees({ profileIds: ids }), HttpError, "too many");
  const emails = Array.from({ length: MAX_EMAILS_PER_REQUEST + 1 }, (_, i) => `p${i}@b.dk`);
  assertThrows(() => readInvitees({ emails }), HttpError, "too many");
});
