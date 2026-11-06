import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";

import { reportAlert } from "./safety.ts";

Deno.test("the alert about a report says what kind and why, and links to admin mode", () => {
  const email = reportAlert("event", "offensive");
  assertEquals(email.subject, "Casy: en ny rapport");
  assertStringIncludes(email.text, "event, offensive");
  assertStringIncludes(email.text, "https://casy.app/profile/admin");
  assertStringIncludes(email.html, "https://casy.app/profile/admin");
});
