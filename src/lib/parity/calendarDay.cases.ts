/** calendarOverview.ts, phoneEvents.ts, dayStrip.ts and tint.ts, for CalendarDay.swift (#199). */
import {
  calendarColors,
  dayKey,
  segmentByDay,
  type DaySegment,
  type OverviewBlock,
  type OverviewCalendar,
} from "@/lib/calendarOverview";
import { placeBlocks, placeSpan } from "@/lib/dayStrip";
import type { PhoneEvent } from "@/lib/phoneBusy";
import { phoneCalendarIds, withPhoneEvents, type PhoneEventWithDetails } from "@/lib/phoneEvents";
import { shade, tint } from "@/lib/tint";
import { startOfDay } from "@/lib/zone";

import { caseBook, type ParityCase } from "./cases";

const TZ = "Europe/Copenhagen";
const HOUR = 3_600_000;
/** Around the autumn's clock change (25 Oct 2026), so a 25-hour day is among them. */
const BASE = Date.UTC(2026, 9, 20, 0);

/** A segment as Swift holds it: its times as epoch ms. */
const plain = (s: DaySegment) => ({
  calendarId: s.calendarId,
  start: s.start.getTime(),
  end: s.end.getTime(),
  allDay: s.allDay,
  continuesBefore: s.continuesBefore,
  continuesAfter: s.continuesAfter,
  ...(s.details && { details: s.details }),
});

export function calendarDayCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261115);
  const flag = (odds: number) => random() < odds;

  const block = (calendarId: string): OverviewBlock => {
    const start = BASE + int(-2 * 24, 10 * 24) * HOUR + int(0, 3) * 900_000;
    const length = flag(0.15) ? int(20, 80) * HOUR : int(-1, 12) * 1_800_000;
    return {
      calendarId,
      start: new Date(start).toISOString(),
      end: new Date(start + length).toISOString(),
    };
  };

  for (let i = 0; i < 80; i++) {
    const blocks = Array.from({ length: int(0, 12) }, () => block(pick(["a", "b", "c"])));
    const from = BASE + int(-1, 3) * 24 * HOUR;
    const to = from + int(1, 9) * 24 * HOUR;
    const byDay = segmentByDay(blocks, new Date(from), new Date(to), TZ);
    const output = Object.fromEntries([...byDay].map(([k, list]) => [k, list.map(plain)]));
    add("segmentByDay", { blocks, from, to, timeZone: TZ }, output);
  }

  for (let i = 0; i < 40; i++) {
    const ms = BASE + int(-400, 400) * HOUR + int(0, 59) * 60_000;
    add("dayKey", { ms, timeZone: TZ }, dayKey(new Date(ms), TZ));
  }

  const calendar = (n: number): OverviewCalendar => ({
    id: `cal${n}`,
    name: `Cal ${n}`,
    originalName: null,
    renamed: false,
    writable: flag(0.5),
    purpose: pick([null, null, "work", "school", "personal", "other"] as const),
    priority: "normal",
    included: flag(0.8),
    total: int(0, 50),
    provider: pick(["google", "apple", "device", "ics"] as const),
    account: null,
    connectionId: pick(["phone-1", "conn-2"]),
    externalId: flag(0.6) ? `ek${n}` : null,
  });
  for (let i = 0; i < 30; i++) {
    const calendars = Array.from({ length: int(0, 10) }, (_, n) => calendar(n));
    const own = Object.fromEntries(
      calendars
        .filter(() => flag(0.2))
        .map((c) => [c.id, `${int(0, 255)}, ${int(0, 255)}, ${int(0, 255)}`]),
    );
    const colors = calendarColors(calendars, new Map(Object.entries(own)));
    add("calendarColors", { calendars, own }, Object.fromEntries(colors));
    add(
      "phoneCalendarIds",
      { calendars, connectionId: "phone-1" },
      Object.fromEntries(phoneCalendarIds(calendars, "phone-1")),
    );
  }

  const phoneEvent = (calendarId: string): PhoneEventWithDetails => {
    const base: PhoneEvent = {
      calendarId,
      free: flag(0.15),
      cancelled: flag(0.1),
      declined: flag(0.1),
      allDay: false,
      start: BASE + int(-24, 240) * HOUR,
      end: 0,
    };
    base.end = (base.start ?? 0) + int(0, 6) * 1_800_000;
    const allDay: PhoneEvent | null = flag(0.2)
      ? {
          ...base,
          allDay: true,
          start: undefined,
          end: undefined,
          startDay: "2026-10-22",
          endDay: pick(["2026-10-22", "2026-10-24"]),
        }
      : null;
    return {
      ...(allDay ?? base),
      ...(flag(0.8) && { title: pick(["  Tandlæge ", "Møde", "", "\tFødselsdag\n"]) }),
      ...(flag(0.5) && { location: pick(["Hjemme", " Kontoret "]) }),
      ...(flag(0.3) && { notes: "Husk" }),
    };
  };
  for (let i = 0; i < 40; i++) {
    const blocks = Array.from({ length: int(0, 8) }, () => block(pick(["cal0", "cal1", "cal2"])));
    const events = Array.from({ length: int(0, 8) }, () => phoneEvent(pick(["ek0", "ek1", "ek9"])));
    const serverIdOf = flag(0.15) ? {} : pick([{ ek0: "cal0" }, { ek0: "cal0", ek1: "cal1" }]);
    const from = BASE;
    const to = BASE + 7 * 24 * HOUR;
    add(
      "withPhoneEvents",
      { blocks, events, serverIdOf, from, to },
      withPhoneEvents(blocks, events, new Map(Object.entries(serverIdOf)), { from, to }),
    );
  }

  for (let i = 0; i < 40; i++) {
    const midnight = startOfDay(BASE + int(0, 9) * 24 * HOUR, TZ);
    const start = midnight + int(-6, 28) * 900_000 * 4;
    const end = start + int(-2, 40) * 900_000;
    const span = placeSpan(start, end, midnight, TZ);
    add("placeSpan", { start, end, midnight, timeZone: TZ }, span);
  }

  for (let i = 0; i < 60; i++) {
    const midnight = startOfDay(BASE + int(0, 9) * 24 * HOUR, TZ);
    const segments: DaySegment[] = Array.from({ length: int(0, 7) }, (_, n) => {
      const start = midnight + int(0, 23 * 4) * 900_000;
      const allDay = flag(0.1);
      return {
        calendarId: `c${n}`,
        start: new Date(allDay ? midnight : start),
        end: new Date(allDay ? midnight + 24 * HOUR : start + int(1, 12) * 900_000),
        allDay,
        continuesBefore: false,
        continuesAfter: false,
      };
    });
    const minHeight = pick([0, 0.02, 0.05]);
    const together = pick([undefined, 0.03]);
    const placed = placeBlocks(segments, midnight, TZ, minHeight, together);
    add(
      "placeBlocks",
      { segments: segments.map(plain), midnight, timeZone: TZ, minHeight, together },
      placed.map((p) => ({ ...p, segment: plain(p.segment) })),
    );
  }

  for (const rgb of [
    "59, 130, 246",
    "168, 85, 247",
    "34, 197, 94",
    "113, 113, 122",
    "249, 115, 22",
    "220, 38, 38",
    "234, 88, 12",
    "0, 0, 0",
    "255, 255, 255",
    "20, 20, 60",
    "250, 240, 10",
  ]) {
    for (const dark of [false, true]) {
      add("tint", { rgb, dark }, tint(rgb, dark));
      add("shade", { rgb, dark }, shade(rgb, dark));
    }
  }
  return cases;
}
