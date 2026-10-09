// Run with: deno test --node-modules-dir=none supabase/functions/_shared/
import { assertEquals, assertThrows } from "jsr:@std/assert@1";

import { HttpError } from "./http.ts";
import {
  hashDeviceToken,
  MAX_BLOCKS,
  MAX_CALENDARS,
  newDeviceToken,
  parsePhonePush,
} from "./phoneCalendars.ts";

const NOW = new Date("2026-10-09T10:00:00.000Z");
const DEVICE = "6F1C2D3E-4A5B-4C6D-8E9F-0A1B2C3D4E5F";
const block = (start: string, end: string) => ({ start, end });

Deno.test("a push is normalised: lower-case id, default label, trimmed names, ISO times", () => {
  const push = parsePhonePush(
    {
      deviceId: DEVICE,
      create: true,
      calendars: [
        {
          id: "cal-1",
          name: "  Home\n ",
          hidden: false,
          blocks: [block("2026-10-12T10:00:00+02:00", "2026-10-12T11:00:00+02:00")],
        },
      ],
    },
    NOW,
  );
  assertEquals(push, {
    deviceId: DEVICE.toLowerCase(),
    label: "iPhone",
    create: true,
    calendars: [
      {
        id: "cal-1",
        name: "Home",
        hidden: false,
        blocks: [block("2026-10-12T08:00:00.000Z", "2026-10-12T09:00:00.000Z")],
      },
    ],
  });
});

Deno.test("create is only ever an explicit true", () => {
  assertEquals(
    parsePhonePush({ deviceId: DEVICE, calendars: [], create: "yes" }, NOW).create,
    false,
  );
});

Deno.test(
  "blocks wholly outside the window are dropped; one reaching into it is kept whole",
  () => {
    const push = parsePhonePush(
      {
        deviceId: DEVICE,
        calendars: [
          {
            id: "a",
            name: "A",
            blocks: [
              block("2026-09-01T08:00:00Z", "2026-09-01T09:00:00Z"),
              block("2026-10-01T22:00:00Z", "2026-10-03T22:00:00Z"),
              block("2028-01-01T08:00:00Z", "2028-01-01T09:00:00Z"),
            ],
          },
        ],
      },
      NOW,
    );
    assertEquals(push.calendars[0].blocks, [
      block("2026-10-01T22:00:00.000Z", "2026-10-03T22:00:00.000Z"),
    ]);
  },
);

Deno.test("the same calendar twice is kept once", () => {
  const push = parsePhonePush(
    {
      deviceId: DEVICE,
      calendars: [
        { id: "a", name: "First", blocks: [] },
        { id: "a", name: "Second", blocks: [] },
      ],
    },
    NOW,
  );
  assertEquals(
    push.calendars.map((c) => c.name),
    ["First"],
  );
});

Deno.test("anything malformed is refused with a 400", () => {
  const bad: Record<string, unknown>[] = [
    { calendars: [] },
    { deviceId: "not-a-uuid", calendars: [] },
    { deviceId: DEVICE },
    { deviceId: DEVICE, calendars: [{ name: "No id", blocks: [] }] },
    { deviceId: DEVICE, calendars: [{ id: "a", name: "A" }] },
    { deviceId: DEVICE, calendars: [{ id: "a", blocks: [{ start: "soon", end: "later" }] }] },
    {
      deviceId: DEVICE,
      calendars: [{ id: "a", blocks: [block("2026-10-12T09:00:00Z", "2026-10-12T08:00:00Z")] }],
    },
    {
      deviceId: DEVICE,
      calendars: Array.from({ length: MAX_CALENDARS + 1 }, (_, i) => ({ id: `c${i}`, blocks: [] })),
    },
  ];
  for (const body of bad) {
    const err = assertThrows(() => parsePhonePush(body, NOW), HttpError);
    assertEquals(err.status, 400);
  }
});

Deno.test("more busy blocks than the bound are refused", () => {
  const blocks = Array.from({ length: MAX_BLOCKS + 1 }, (_, i) => {
    const start = Date.parse("2026-10-10T00:00:00Z") + i * 600_000;
    return block(new Date(start).toISOString(), new Date(start + 300_000).toISOString());
  });
  assertThrows(
    () => parsePhonePush({ deviceId: DEVICE, calendars: [{ id: "a", blocks }] }, NOW),
    HttpError,
    "Too many busy times",
  );
});

Deno.test(
  "device tokens are long, URL-safe and different each time; their hash is stable hex",
  async () => {
    const a = newDeviceToken();
    const b = newDeviceToken();
    assertEquals(/^[A-Za-z0-9_-]{43}$/.test(a), true);
    assertEquals(a === b, false);
    assertEquals(await hashDeviceToken(a), await hashDeviceToken(a));
    assertEquals(
      await hashDeviceToken("abc"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  },
);
