import { describe, expect, it } from "vitest";

import type { EventImpact } from "@/api/eventProfile";
import type { EventLabel } from "@/api/eventLabels";
import { impactOn } from "@/lib/eventImpact";
import { labelKey } from "@/lib/eventLabels";
import type { EventSettings } from "@/lib/eventSearch";
import { importantClashes, labelledEvents, type LabelledEvent } from "@/lib/eventWarnings";
import { APP_TIME_ZONE } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/** A time in January 2027 (winter time, UTC+1) by its Danish clock. */
const dk = (day: number, hour: number, minute = 0) =>
  new Date(Date.UTC(2027, 0, day, hour - 1, minute)).toISOString();

const meeting: EventSettings = { kind: "single", durationMinutes: 540, startHour: 17 };

const label = (over: Partial<EventLabel> = {}): EventLabel => ({
  kind: "exam",
  importance: "critical",
  prepDays: 3,
  avoidBefore: ["lateNight", "alcohol"],
  recoveryDays: 0,
  strain: "heavy",
  confidence: "high",
  reason: "",
  ...over,
});

const profile = (over: Partial<EventImpact> = {}): EventImpact => ({
  v: 1,
  effects: [],
  runsLate: false,
  strain: "light",
  recoveryDays: 0,
  outdoors: false,
  daylight: false,
  confidence: "high",
  reason: "",
  ...over,
});

const julefrokost = profile({
  effects: ["lateNight", "alcohol"],
  runsLate: true,
  strain: "heavy",
  recoveryDays: 1,
});

/** The exam at 12:00 on 11 January. */
const exam: LabelledEvent = {
  title: "Eksamen",
  start: Date.parse(dk(11, 12)),
  end: Date.parse(dk(11, 16)),
  allDay: false,
  label: label(),
};

const clashes = (
  p: EventImpact | null,
  start: string,
  end: string,
  mine: LabelledEvent[] = [exam],
) => importantClashes(impactOn(p, { start, end }, meeting, TZ), mine, TZ);

describe("importantClashes", () => {
  it("flags a julefrokost the night before an exam, and what to keep clear of", () => {
    const [clash, ...rest] = clashes(julefrokost, dk(10, 17), dk(11, 2));
    expect(rest).toEqual([]);
    expect(clash).toMatchObject({
      kind: "nightBefore",
      severity: "critical",
      // Until 02:00 is still the evening before.
      daysAfter: 1,
      avoid: ["lateNight", "alcohol"],
    });
    expect(clash.event.title).toBe("Eksamen");
  });

  it("flags it even when planned for the daytime: the drinking is the problem", () => {
    expect(clashes(julefrokost, dk(10, 10), dk(10, 15))[0]).toMatchObject({
      kind: "nightBefore",
      daysAfter: 1,
      avoid: ["lateNight", "alcohol"],
    });
  });

  it("wants the day before a critical event free, but lets a coffee through", () => {
    // A three-hour dinner, nothing known about it: too much the day before.
    expect(clashes(null, dk(10, 18), dk(10, 21))[0]).toMatchObject({
      kind: "prepDayBefore",
      severity: "critical",
    });
    // An hour's coffee, light: fine.
    expect(clashes(profile(), dk(10, 10), dk(10, 11))).toEqual([]);
  });

  it("further out, flags only something big, as a warning", () => {
    expect(clashes(profile({ strain: "moderate" }), dk(8, 18), dk(8, 21))[0]).toMatchObject({
      kind: "prep",
      severity: "warning",
      daysAfter: 3,
    });
    expect(clashes(profile(), dk(8, 18), dk(8, 19))).toEqual([]);
    // Beyond the prep days: nothing.
    expect(clashes(julefrokost, dk(6, 17), dk(7, 2))).toEqual([]);
  });

  it("flags needing a day to recover before something that matters", () => {
    const interview = {
      ...exam,
      label: label({ kind: "interview", importance: "high", prepDays: 0, avoidBefore: [] }),
    };
    expect(clashes(julefrokost, dk(10, 12), dk(10, 16), [interview])[0]).toMatchObject({
      kind: "recovery",
      severity: "warning",
    });
  });

  it("leaves ordinary events, and ones already over or overlapping, alone", () => {
    const ordinary = { ...exam, label: label({ importance: "normal" }) };
    expect(clashes(julefrokost, dk(10, 17), dk(11, 2), [ordinary])).toEqual([]);
    const before = { ...exam, start: Date.parse(dk(9, 12)), end: Date.parse(dk(9, 16)) };
    expect(clashes(julefrokost, dk(10, 17), dk(11, 2), [before])).toEqual([]);
    const during = { ...exam, start: Date.parse(dk(10, 19)), end: Date.parse(dk(10, 20)) };
    expect(clashes(julefrokost, dk(10, 17), dk(11, 2), [during])).toEqual([]);
  });

  it("puts critical ones first, then the soonest", () => {
    const deadline: LabelledEvent = {
      title: "Aflevering",
      start: Date.parse(dk(12, 9)),
      end: Date.parse(dk(12, 10)),
      allDay: false,
      label: label({ kind: "deadline", importance: "high", prepDays: 2, avoidBefore: [] }),
    };
    const found = clashes(julefrokost, dk(10, 17), dk(11, 2), [deadline, exam]);
    expect(found.map((c) => [c.event.title, c.severity])).toEqual([
      ["Eksamen", "critical"],
      ["Aflevering", "warning"],
    ]);
  });
});

describe("labelledEvents", () => {
  it("pairs the phone's events with their labels, leaving out what doesn't count", () => {
    const base = { calendarId: "ek-uni", allDay: false, free: false, declined: false };
    const events = [
      { ...base, cancelled: false, title: "Eksamen", start: exam.start, end: exam.end },
      { ...base, cancelled: true, title: "Eksamen", start: exam.start, end: exam.end },
      { ...base, cancelled: false, title: "Uden etiket", start: exam.start, end: exam.end },
    ];
    const book = { [labelKey("ek-uni", "eksamen")]: { ...label(), count: 1 } };
    const mine = labelledEvents(events, book);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ title: "Eksamen", start: exam.start });
  });
});
