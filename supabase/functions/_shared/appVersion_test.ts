import { assertEquals } from "jsr:@std/assert@1";

import { appVersionInfo } from "./appVersion.ts";

Deno.test("appVersionInfo passes on a version and an App Store link", () => {
  assertEquals(appVersionInfo(" 1.2.0 ", "https://apps.apple.com/dk/app/casy/id123"), {
    minVersion: "1.2.0",
    storeUrl: "https://apps.apple.com/dk/app/casy/id123",
  });
});

Deno.test("appVersionInfo leaves out what is missing or malformed", () => {
  assertEquals(appVersionInfo(), { minVersion: null, storeUrl: null });
  assertEquals(appVersionInfo("v2", "https://example.com/casy"), {
    minVersion: null,
    storeUrl: null,
  });
});
