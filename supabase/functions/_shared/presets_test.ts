import { assertEquals } from "jsr:@std/assert@1";

import { MAX_PLAN_BYTES, readPreset, readUuid } from "./presets.ts";

const ID = "6f1c2b3a-1111-4222-8333-944455556666";

Deno.test("a genvej is read with its name tidied, and its id checked", () => {
  assertEquals(readPreset({ name: "  Padel   tennis ", plan: { title: "Padel" } }), {
    id: null,
    name: "Padel tennis",
    plan: { title: "Padel" },
  });
  assertEquals(readPreset({ id: ID.toUpperCase(), name: "x", plan: {} })?.id, ID);
  assertEquals(readUuid("not-a-uuid"), null);
});

Deno.test("a genvej with a bad name, id or plan is turned away", () => {
  for (const body of [
    { name: "", plan: {} },
    { name: "x".repeat(41), plan: {} },
    { name: 3, plan: {} },
    { id: "nope", name: "x", plan: {} },
    { name: "x", plan: [] },
    { name: "x", plan: null },
    { name: "x", plan: { note: "y".repeat(MAX_PLAN_BYTES) } },
  ]) {
    assertEquals(readPreset(body as Record<string, unknown>), null);
  }
});
