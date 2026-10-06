import { describe, it, expect } from "vitest";
import {
  buildMonthLayout,
  calendarColors,
  dayKey,
  groupCalendarsByBrand,
  groupVisibility,
  isoWeekNumber,
  formatDuration,
  formatSegmentRange,
  HOLIDAY_CALENDAR,
  HOLIDAY_CALENDAR_ID,
  holidaySegmentsByDay,
  segmentByDay,
  withHolidays,
  type OverviewBlock,
  type OverviewCalendar,
} from "@/lib/calendarOverview";
import { wallTime } from "@/lib/zone";

/**
 * Tests for the calendar overview's layout logic.
 *
 * Days are days in the zone passed in (Danish time, like the page), never the
 * machine's: instants are built with wallTime in that zone, so the
 * expectations hold whatever zone the tests run in (vite.config.ts runs them
 * in New York to make sure).
 */

const TZ = "Europe/Copenhagen";

/** An instant in Danish time, `m` 1-based like the dates in the test names. */
const iso = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(wallTime(y, m - 1, d, h + min / 60, TZ)).toISOString();

/** Midnight in Danish time, `m0` 0-based like the month arguments below. */
const midnight = (y: number, m0: number, d: number) => new Date(wallTime(y, m0, d, 0, TZ));

const block = (start: string, end: string, calendarId = "cal"): OverviewBlock => ({
  calendarId,
  start,
  end,
});

/** What every calendar carries that these tests don't look at. */
const DEFAULTS = {
  originalName: null,
  renamed: false,
  writable: false,
  priority: "normal",
  included: true,
  total: 0,
} as const;

describe("buildMonthLayout", () => {
  it("pads September 2026 (starts on a Tuesday) with one leading day, 5 rows", () => {
    const layout = buildMonthLayout(2026, 8, TZ);
    expect(layout.weeks).toHaveLength(5);
    expect(layout.weeks.every((w) => w.length === 7)).toBe(true);
    expect(layout.weeks[0][0].key).toBe("2026-08-31"); // Monday
    expect(layout.weeks[0][0].inMonth).toBe(false);
    expect(layout.weeks[0][1].key).toBe("2026-09-01");
    expect(layout.weeks[0][1].inMonth).toBe(true);
    expect(layout.weeks[4][6].key).toBe("2026-10-04"); // trailing spill-over
    expect(layout.weeks[4][6].inMonth).toBe(false);
    expect(layout.weekdayLabels).toEqual([
      "man.",
      "tirs.",
      "ons.",
      "tors.",
      "fre.",
      "lør.",
      "søn.",
    ]);
  });

  it("needs 6 rows when a 31-day month starts late in the week (August 2026)", () => {
    const layout = buildMonthLayout(2026, 7, TZ); // Aug 1 2026 is a Saturday
    expect(layout.weeks).toHaveLength(6);
    expect(layout.weeks[0][5].key).toBe("2026-08-01");
  });

  it("uses exactly 4 rows when the month fits (February 2027 starts on a Monday)", () => {
    expect(buildMonthLayout(2027, 1, TZ).weeks).toHaveLength(4);
  });

  it("exposes a half-open range covering exactly the grid", () => {
    const layout = buildMonthLayout(2026, 8, TZ);
    expect(dayKey(layout.from, TZ)).toBe("2026-08-31");
    expect(dayKey(layout.to, TZ)).toBe("2026-10-05"); // the day after the last cell
  });

  it("walks across a year boundary (December 2026)", () => {
    const layout = buildMonthLayout(2026, 11, TZ);
    expect(layout.weeks.flat().some((d) => d.key === "2027-01-03")).toBe(true);
  });

  it("labels the month in Danish by default", () => {
    expect(buildMonthLayout(2026, 8, TZ).label).toBe("september 2026");
  });
});

describe("segmentByDay", () => {
  const from = midnight(2026, 8, 1);
  const to = midnight(2026, 9, 1);

  it("keeps a same-day block as one segment", () => {
    const seg = segmentByDay(
      [block(iso(2026, 9, 22, 9, 15), iso(2026, 9, 22, 11, 20))],
      from,
      to,
      TZ,
    );
    expect([...seg.keys()]).toEqual(["2026-09-22"]);
    const [s] = seg.get("2026-09-22")!;
    expect(s.allDay).toBe(false);
    expect(s.continuesBefore || s.continuesAfter).toBe(false);
    expect(formatSegmentRange(s, TZ)).toBe("09:15-11:20");
    expect(formatDuration(s.start, s.end)).toBe("2 h 5 min");
  });

  it("splits an overnight block across two days", () => {
    const seg = segmentByDay([block(iso(2026, 9, 25, 22), iso(2026, 9, 26, 2))], from, to, TZ);
    const fri = seg.get("2026-09-25")![0];
    const sat = seg.get("2026-09-26")![0];
    expect(formatSegmentRange(fri, TZ)).toBe("22:00-24:00");
    expect(fri.continuesAfter).toBe(true);
    expect(fri.continuesBefore).toBe(false);
    expect(formatSegmentRange(sat, TZ)).toBe("00:00-02:00");
    expect(sat.continuesBefore).toBe(true);
    expect(sat.continuesAfter).toBe(false);
  });

  it("makes the middle day of a three-day block an all-day segment", () => {
    const seg = segmentByDay([block(iso(2026, 9, 25, 22), iso(2026, 9, 27, 2))], from, to, TZ);
    const mid = seg.get("2026-09-26")![0];
    expect(mid.allDay).toBe(true);
    expect(formatSegmentRange(mid, TZ)).toBe("All day");
    expect(mid.continuesBefore && mid.continuesAfter).toBe(true);
  });

  it("treats a midnight-to-midnight block (an all-day event) as one all-day segment", () => {
    const seg = segmentByDay([block(iso(2026, 9, 10), iso(2026, 9, 11))], from, to, TZ);
    expect([...seg.keys()]).toEqual(["2026-09-10"]);
    const [s] = seg.get("2026-09-10")!;
    expect(s.allDay).toBe(true);
    expect(s.continuesBefore || s.continuesAfter).toBe(false);
  });

  it("clips blocks at the range edges", () => {
    const seg = segmentByDay([block(iso(2026, 8, 30, 12), iso(2026, 9, 2, 12))], from, to, TZ);
    expect([...seg.keys()].sort()).toEqual(["2026-09-01", "2026-09-02"]);
    expect(seg.get("2026-09-01")![0].allDay).toBe(true);
  });

  it("ignores blocks entirely outside the range and malformed ones", () => {
    const seg = segmentByDay(
      [
        block(iso(2026, 8, 1, 9), iso(2026, 8, 1, 10)),
        block(iso(2026, 10, 1, 9), iso(2026, 10, 1, 10)), // starts exactly at `to`
        block(iso(2026, 9, 5, 10), iso(2026, 9, 5, 9)), // ends before it starts
      ],
      from,
      to,
      TZ,
    );
    expect(seg.size).toBe(0);
  });

  it("sorts each day's segments by start time and keeps their calendars", () => {
    const seg = segmentByDay(
      [
        block(iso(2026, 9, 22, 14), iso(2026, 9, 22, 15), "b"),
        block(iso(2026, 9, 22, 8), iso(2026, 9, 22, 9), "a"),
      ],
      from,
      to,
      TZ,
    );
    expect(seg.get("2026-09-22")!.map((s) => s.calendarId)).toEqual(["a", "b"]);
  });

  it("loses no time: segment durations add up to the block, even across DST changes", () => {
    // Spans 25 Oct 2026 (clocks change in Europe) and 29 Mar 2026-style edges alike.
    const start = iso(2026, 10, 23, 18);
    const end = iso(2026, 10, 27, 7);
    const seg = segmentByDay([block(start, end)], midnight(2026, 9, 1), midnight(2026, 10, 1), TZ);
    const total = [...seg.values()]
      .flat()
      .reduce((sum, s) => sum + (s.end.getTime() - s.start.getTime()), 0);
    expect(total).toBe(Date.parse(end) - Date.parse(start));
  });
});

describe("days and times in the zone given, not the machine's", () => {
  it("names the day by the zone: 00:30 in Copenhagen is still the day before in UTC", () => {
    const d = new Date("2026-09-22T22:30:00Z");
    expect(dayKey(d, TZ)).toBe("2026-09-23");
    expect(dayKey(d, "UTC")).toBe("2026-09-22");
  });

  it("splits at Danish midnight and shows Danish times", () => {
    // 23:30 to 00:30 Danish time: two days in Copenhagen, one afternoon in New York.
    const b = block("2026-09-22T21:30:00Z", "2026-09-22T22:30:00Z");
    const dk = segmentByDay([b], midnight(2026, 8, 1), midnight(2026, 9, 1), TZ);
    expect([...dk.keys()]).toEqual(["2026-09-22", "2026-09-23"]);
    expect(formatSegmentRange(dk.get("2026-09-22")![0], TZ)).toBe("23:30-24:00");

    const ny = "America/New_York";
    const nySeg = segmentByDay(
      [b],
      new Date("2026-09-01T04:00:00Z"),
      new Date("2026-10-01T04:00:00Z"),
      ny,
    );
    expect([...nySeg.keys()]).toEqual(["2026-09-22"]);
    expect(formatSegmentRange(nySeg.get("2026-09-22")![0], ny)).toBe("17:30-18:30");
  });

  it("starts each grid cell at Danish midnight, 23 hours long on the spring-forward Sunday", () => {
    const march = buildMonthLayout(2026, 2, TZ).weeks.flat();
    const i = march.findIndex((d) => d.key === "2026-03-29");
    expect(march[i].date.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(march[i + 1].date.getTime() - march[i].date.getTime()).toBe(23 * 3_600_000);
    // A whole Danish day of busy time on that Sunday is one all-day segment.
    const seg = segmentByDay(
      [block(march[i].date.toISOString(), march[i + 1].date.toISOString())],
      march[0].date,
      march[march.length - 1].date,
      TZ,
    ).get("2026-03-29")!;
    expect(seg).toHaveLength(1);
    expect(seg[0].allDay).toBe(true);
  });

  it("labels the month in the page's language", () => {
    expect(buildMonthLayout(2026, 9, TZ, "en-GB").label).toBe("October 2026");
  });
});

describe("formatDuration", () => {
  it("formats minutes, whole hours and mixed", () => {
    const t = (min: number) => formatDuration(new Date(0), new Date(min * 60_000));
    expect(t(45)).toBe("45 min");
    expect(t(180)).toBe("3 h");
    expect(t(155)).toBe("2 h 35 min");
  });
});

describe("calendarColors", () => {
  const cal = (id: string, purpose: OverviewCalendar["purpose"]): OverviewCalendar => ({
    ...DEFAULTS,
    id,
    name: id,
    purpose,
    provider: "ics",
    account: null,
    connectionId: "c",
  });

  it("colours by category when set, and gives uncategorised calendars distinct palette colours", () => {
    const colors = calendarColors([
      cal("a", "school"),
      cal("b", null),
      cal("c", null),
      cal("d", "school"),
    ]);
    expect(colors.get("a")).toBe(colors.get("d")); // same category, same colour
    expect(colors.get("b")).not.toBe(colors.get("c"));
    expect(colors.get("a")).not.toBe(colors.get("b"));
  });

  it("reuses the palette instead of failing when there are many uncategorised calendars", () => {
    const many = Array.from({ length: 12 }, (_, i) => cal(`x${i}`, null));
    const colors = calendarColors(many);
    expect(colors.size).toBe(13); // 12 calendars plus the built-in holiday calendar
    expect(colors.get("x0")).toBe(colors.get("x7")); // palette has 7 colours
  });
});

describe("built-in Danish holidays", () => {
  it("places the April 2026 holidays on the right days of the grid (Easter is 5 April)", () => {
    const layout = buildMonthLayout(2026, 3, TZ);
    const byDay = holidaySegmentsByDay(layout.from, layout.to, TZ);
    const names = (key: string) => byDay.get(key)?.map((s) => s.holiday?.name);
    expect(names("2026-04-02")).toEqual(["Skærtorsdag"]);
    expect(names("2026-04-03")).toEqual(["Langfredag"]);
    expect(names("2026-04-05")).toEqual(["Påskedag"]);
    expect(names("2026-04-06")).toEqual(["2. påskedag"]);
    expect(byDay.size).toBe(4);
  });

  it("marks holiday segments as all-day, on the built-in calendar, spanning exactly that local day", () => {
    const layout = buildMonthLayout(2026, 3, TZ);
    const seg = holidaySegmentsByDay(layout.from, layout.to, TZ).get("2026-04-03")![0];
    expect(seg.calendarId).toBe(HOLIDAY_CALENDAR_ID);
    expect(seg.allDay).toBe(true);
    expect(formatSegmentRange(seg, TZ)).toBe("All day");
    expect(dayKey(seg.start, TZ)).toBe("2026-04-03");
    expect(dayKey(seg.end, TZ)).toBe("2026-04-04");
  });

  it("includes days from the next year when a December grid spills into January", () => {
    const layout = buildMonthLayout(2026, 11, TZ); // grid runs to Sunday 3 January 2027
    const byDay = holidaySegmentsByDay(layout.from, layout.to, TZ);
    expect([...byDay.keys()]).toEqual([
      "2026-12-24",
      "2026-12-25",
      "2026-12-26",
      "2026-12-31",
      "2027-01-01",
    ]);
  });

  it("only returns holidays inside the requested range", () => {
    const byDay = holidaySegmentsByDay(midnight(2026, 3, 3), midnight(2026, 3, 6), TZ); // 3 to 5 April
    expect([...byDay.keys()]).toEqual(["2026-04-03", "2026-04-05"]);
  });

  it("puts a day's holidays before its timed blocks without changing the inputs", () => {
    const from = midnight(2026, 3, 1);
    const to = midnight(2026, 4, 1);
    const timed = segmentByDay([block(iso(2026, 4, 3, 9), iso(2026, 4, 3, 10), "x")], from, to, TZ);
    const holidays = holidaySegmentsByDay(from, to, TZ);
    const merged = withHolidays(timed, holidays);
    expect(merged.get("2026-04-03")!.map((s) => s.holiday?.name ?? s.calendarId)).toEqual([
      "Langfredag",
      "x",
    ]);
    expect(timed.get("2026-04-03")).toHaveLength(1); // untouched
    expect(merged.get("2026-04-02")).toHaveLength(1); // holiday on a day with no blocks
  });

  it("is a fixed calendar with no account and its own colour, distinct from the palette", () => {
    expect(HOLIDAY_CALENDAR.provider).toBe("builtin");
    expect(HOLIDAY_CALENDAR.account).toBeNull();
    const many = Array.from({ length: 10 }, (_, i) => ({
      ...DEFAULTS,
      id: `x${i}`,
      name: `x${i}`,
      purpose: null,
      provider: "ics" as const,
      account: null,
      connectionId: "c",
    }));
    const colors = calendarColors(many);
    expect(
      [...colors.entries()].filter(
        ([id, rgb]) => id !== HOLIDAY_CALENDAR_ID && rgb === colors.get(HOLIDAY_CALENDAR_ID),
      ),
    ).toEqual([]);
  });
});

describe("isoWeekNumber", () => {
  const week = (y: number, m: number, d: number) => isoWeekNumber(midnight(y, m - 1, d), TZ);

  it("numbers September 2026 weeks 36 to 40 (Monday 21 September starts week 39)", () => {
    expect(week(2026, 8, 31)).toBe(36);
    expect(week(2026, 9, 7)).toBe(37);
    expect(week(2026, 9, 14)).toBe(38);
    expect(week(2026, 9, 21)).toBe(39);
    expect(week(2026, 9, 28)).toBe(40);
  });

  it("gives every day of a week the same number, Monday to Sunday", () => {
    for (let d = 21; d <= 27; d++) expect(week(2026, 9, d)).toBe(39);
    expect(week(2026, 9, 28)).toBe(40); // the next Monday starts a new week
  });

  it("puts 1 January in week 1 when it falls Monday to Thursday (2026 starts on a Thursday)", () => {
    expect(week(2026, 1, 1)).toBe(1);
    expect(week(2025, 12, 29)).toBe(1); // Monday of that week, still in December
    expect(week(2025, 12, 28)).toBe(52);
    expect(week(2024, 1, 1)).toBe(1);
  });

  it("puts 1 January in the previous year's last week when it falls Friday to Sunday", () => {
    expect(week(2027, 1, 1)).toBe(53); // 2026 has 53 weeks
    expect(week(2027, 1, 3)).toBe(53);
    expect(week(2027, 1, 4)).toBe(1);
    expect(week(2021, 1, 3)).toBe(53); // 2020 had 53 weeks
    expect(week(2022, 1, 1)).toBe(52);
  });

  it("puts late December in week 1 of the next year when its Thursday is in January", () => {
    expect(week(2024, 12, 30)).toBe(1); // Monday, week 1 of 2025
    expect(week(2019, 12, 30)).toBe(1); // week 1 of 2020
    expect(week(2026, 12, 31)).toBe(53);
  });

  it("is not thrown off by the days the clocks change", () => {
    expect(week(2026, 3, 29)).toBe(13); // Sunday, clocks go forward in Europe
    expect(week(2026, 10, 25)).toBe(43); // Sunday, clocks go back
  });
});

describe("month layout week numbers", () => {
  it("has one number per row, matching the Monday of each row", () => {
    const layout = buildMonthLayout(2026, 8, TZ); // September 2026, grid starts Monday 31 August
    expect(layout.weekNumbers).toEqual([36, 37, 38, 39, 40]);
    expect(layout.weekNumbers).toHaveLength(layout.weeks.length);
  });

  it("ends the December 2026 grid with week 52 then week 53 across the year boundary", () => {
    const layout = buildMonthLayout(2026, 11, TZ); // December 2026, grid runs to 3 January 2027
    // last two rows: 21 to 27 Dec is week 52, and 28 Dec to 3 Jan 2027 is week 53
    expect(layout.weekNumbers.slice(-2)).toEqual([52, 53]);
  });

  it("handles a six-row month", () => {
    const layout = buildMonthLayout(2026, 7, TZ); // August 2026 needs six rows
    expect(layout.weekNumbers).toEqual([31, 32, 33, 34, 35, 36]);
  });
});

describe("groupCalendarsByBrand", () => {
  const cal = (id: string, provider: OverviewCalendar["provider"]): OverviewCalendar => ({
    ...DEFAULTS,
    id,
    name: id,
    purpose: null,
    provider,
    account: null,
    connectionId: `conn-${provider}`,
  });

  it("groups by brand in a fixed order, whatever order the calendars arrive in", () => {
    const groups = groupCalendarsByBrand([
      HOLIDAY_CALENDAR,
      cal("a1", "apple"),
      cal("g1", "google"),
      cal("l1", "ics"),
      cal("o1", "outlook"),
      cal("g2", "google"),
    ]);
    expect(groups.map((g) => g.label)).toEqual([
      "Google",
      "Outlook",
      "Apple",
      "Special",
      "Built in",
    ]);
    expect(groups[0].calendars.map((c) => c.id)).toEqual(["g1", "g2"]);
  });

  it("calls calendars added by link 'Special'", () => {
    const groups = groupCalendarsByBrand([cal("l1", "ics")]);
    expect(groups).toEqual([
      { id: "ics", label: "Special", calendars: [expect.objectContaining({ id: "l1" })] },
    ]);
  });

  it("leaves out brands with no calendars", () => {
    const groups = groupCalendarsByBrand([cal("a1", "apple")]);
    expect(groups.map((g) => g.id)).toEqual(["apple"]);
    expect(groupCalendarsByBrand([])).toEqual([]);
  });

  it("keeps a calendar from a provider it doesn't know about, in a group at the end", () => {
    const groups = groupCalendarsByBrand([
      cal("g1", "google"),
      cal("x1", "yahoo" as OverviewCalendar["provider"]),
      cal("x2", "yahoo" as OverviewCalendar["provider"]),
    ]);
    expect(groups.map((g) => g.id)).toEqual(["google", "yahoo"]);
    expect(groups[1].calendars.map((c) => c.id)).toEqual(["x1", "x2"]);
  });

  it("puts every calendar in exactly one group", () => {
    const all = [cal("g1", "google"), cal("g2", "google"), cal("a1", "apple"), HOLIDAY_CALENDAR];
    const grouped = groupCalendarsByBrand(all).flatMap((g) => g.calendars.map((c) => c.id));
    expect(grouped.sort()).toEqual(all.map((c) => c.id).sort());
  });
});

describe("groupVisibility", () => {
  const group = (unticked: string[]) => ({
    id: "google" as const,
    label: "Google",
    calendars: ["a", "b", "c"].map((id) => ({
      ...DEFAULTS,
      id,
      name: id,
      purpose: null,
      included: !unticked.includes(id),
      provider: "google" as const,
      account: null,
      connectionId: "conn",
    })),
  });

  it("is 'all' when every calendar in the group is ticked", () => {
    expect(groupVisibility(group([]))).toBe("all");
  });

  it("is 'none' when every calendar in the group is unticked", () => {
    expect(groupVisibility(group(["a", "b", "c"]))).toBe("none");
  });

  it("is 'some' for a mix", () => {
    expect(groupVisibility(group(["b"]))).toBe("some");
    expect(groupVisibility(group(["a", "c"]))).toBe("some");
  });
});
