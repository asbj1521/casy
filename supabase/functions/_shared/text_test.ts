import { assertEquals } from "jsr:@std/assert@1";

import { cleanText, stripControlChars } from "./text.ts";

Deno.test("control characters go, the invisible C1 ones included; letters stay", () => {
  assertEquals(stripControlChars("a\nb\tc\u0000d\u007fe\u0085f"), "abcdef");
  assertEquals(stripControlChars("Æblegrød på Ærø"), "Æblegrød på Ærø");
});

Deno.test("typed text is trimmed, capped without a trailing space, and never blank", () => {
  assertEquals(cleanText("  Fredagsbar  ", 20), "Fredagsbar");
  assertEquals(cleanText("abc def", 4), "abc");
  assertEquals(cleanText("\n\t  ", 20), null);
  assertEquals(cleanText(42, 20), null);
});
