import { describe, expect, it } from "vitest";

import {
  backToBackEnds,
  backToBackNote,
  earlyMorningNote,
  earlyMorningStarts,
} from "@/lib/earlyMorning";
import type { BusyInterval, Participant } from "@/types";

const TZ = "Europe/Copenhagen";
// Thursday 1 October 2026, Danish summer time (UTC+2).
const person = (profileId: string, busy: BusyInterval[]): Participant => ({
  profileId,
  name: profileId,
  busy,
});
const block = (start: string, end: string, extra: Partial<BusyInterval> = {}): BusyInterval => ({
  start,
  end,
  ...extra,
});

// 19:00 to 23:00 local.
const LATE = { start: "2026-10-01T17:00:00.000Z", end: "2026-10-01T21:00:00.000Z" };

describe("earlyMorningStarts", () => {
  it("flags someone with something before 10:00 the morning after a late meeting", () => {
    const nicolai = person("nicolai", [
      block("2026-10-02T06:00:00.000Z", "2026-10-02T10:00:00.000Z"),
    ]); // 08:00
    expect(earlyMorningStarts([nicolai], LATE, TZ)).toEqual([
      { profileId: "nicolai", name: "nicolai", start: "2026-10-02T06:00:00.000Z" },
    ]);
  });

  it("says nothing when the meeting ends before 23:00", () => {
    const early = { start: "2026-10-01T17:00:00.000Z", end: "2026-10-01T20:30:00.000Z" }; // 19:00 to 22:30
    const nicolai = person("nicolai", [
      block("2026-10-02T05:00:00.000Z", "2026-10-02T07:00:00.000Z"),
    ]);
    expect(earlyMorningStarts([nicolai], early, TZ)).toEqual([]);
  });

  it("counts 10:00 itself, but nothing later, and never all-day entries", () => {
    const at10 = person("at10", [block("2026-10-02T08:00:00.000Z", "2026-10-02T09:00:00.000Z")]); // 10:00
    const later = person("later", [
      block("2026-10-02T08:30:00.000Z", "2026-10-02T09:00:00.000Z"), // 10:30
      block("2026-10-01T22:00:00.000Z", "2026-10-02T22:00:00.000Z"), // all of Friday
    ]);
    expect(earlyMorningStarts([at10, later], LATE, TZ).map((s) => s.profileId)).toEqual(["at10"]);
  });

  it("counts a calendar marked skippable: an early lecture is early either way", () => {
    const p = person("p", [
      block("2026-10-02T06:00:00.000Z", "2026-10-02T15:00:00.000Z", { priority: "skip" }),
    ]);
    expect(earlyMorningStarts([p], LATE, TZ).map((s) => s.start)).toEqual([
      "2026-10-02T06:00:00.000Z",
    ]);
  });

  it("reads the morning as the day it ends on when it runs past midnight", () => {
    const night = { start: "2026-10-01T19:00:00.000Z", end: "2026-10-02T00:00:00.000Z" }; // 21:00 to 02:00
    const p = person("p", [block("2026-10-02T05:30:00.000Z", "2026-10-02T07:00:00.000Z")]); // 07:30 same night
    expect(earlyMorningStarts([p], night, TZ).map((s) => s.start)).toEqual([
      "2026-10-02T05:30:00.000Z",
    ]);
  });

  it("lists each person once, by their first thing, soonest first", () => {
    const a = person("a", [
      block("2026-10-02T07:00:00.000Z", "2026-10-02T08:00:00.000Z"),
      block("2026-10-02T06:30:00.000Z", "2026-10-02T07:00:00.000Z"),
    ]);
    const b = person("b", [block("2026-10-02T05:00:00.000Z", "2026-10-02T06:00:00.000Z")]);
    expect(earlyMorningStarts([a, b], LATE, TZ).map((s) => [s.profileId, s.start])).toEqual([
      ["b", "2026-10-02T05:00:00.000Z"],
      ["a", "2026-10-02T06:30:00.000Z"],
    ]);
  });
});

describe("earlyMorningNote", () => {
  const words = {
    you: "Du",
    oneYou: (time: string) => `Du har noget kl. ${time}.`,
    one: (who: string, time: string) => `${who} har noget kl. ${time}.`,
    many: (list: string) => `${list} har noget tidligt.`,
  };
  const at = (profileId: string, start: string) => ({ profileId, name: profileId, start });

  it("names one person, or you, with the time", () => {
    expect(earlyMorningNote([at("nicolai", "2026-10-02T06:00:00.000Z")], "me", "da", words)).toBe(
      "nicolai har noget kl. 08:00.",
    );
    expect(earlyMorningNote([at("me", "2026-10-02T06:00:00.000Z")], "me", "da", words)).toBe(
      "Du har noget kl. 08:00.",
    );
  });

  it("lists several with their times, you first", () => {
    const starts = [
      at("nicolai", "2026-10-02T05:30:00.000Z"),
      at("me", "2026-10-02T06:00:00.000Z"),
    ];
    expect(earlyMorningNote(starts, "me", "da", words)).toBe(
      "Du (08:00) og nicolai (07:30) har noget tidligt.",
    );
  });

  it("says nothing when nobody starts early", () => {
    expect(earlyMorningNote([], "me", "da", words)).toBeNull();
  });
});

describe("backToBackEnds", () => {
  // 16:00 to 19:00 local.
  const AFTER_SCHOOL = { start: "2026-10-01T14:00:00.000Z", end: "2026-10-01T17:00:00.000Z" };

  it("names whoever has something ending exactly when it starts", () => {
    const school = person("me", [block("2026-10-01T06:00:00.000Z", "2026-10-01T14:00:00.000Z")]); // 08:00 to 16:00
    const earlier = person("nicolai", [
      block("2026-10-01T10:00:00.000Z", "2026-10-01T13:45:00.000Z"),
    ]); // to 15:45
    expect(backToBackEnds([school, earlier], AFTER_SCHOOL, TZ)).toEqual([
      { profileId: "me", name: "me" },
    ]);
  });

  it("counts skippable calendars but not all-day entries", () => {
    const skip = person("skip", [
      block("2026-10-01T12:00:00.000Z", "2026-10-01T14:00:00.000Z", { priority: "skip" }),
    ]);
    const midnight = { start: "2026-10-01T22:00:00.000Z", end: "2026-10-02T01:00:00.000Z" }; // 00:00 to 03:00
    const dayOff = person("dayoff", [
      block("2026-09-30T22:00:00.000Z", "2026-10-01T22:00:00.000Z"),
    ]);
    expect(backToBackEnds([skip], AFTER_SCHOOL, TZ).map((p) => p.profileId)).toEqual(["skip"]);
    expect(backToBackEnds([dayOff], midnight, TZ)).toEqual([]);
  });

  it("words it for you, one person, or several with you first", () => {
    const words = {
      you: "Du",
      oneYou: "Du har noget lige før.",
      one: (who: string) => `${who} har noget lige før.`,
      many: (list: string) => `${list} har noget lige før.`,
    };
    const me = { profileId: "me", name: "me" };
    const nicolai = { profileId: "nicolai", name: "Nicolai" };
    expect(backToBackNote([me], "me", "da", words)).toBe("Du har noget lige før.");
    expect(backToBackNote([nicolai], "me", "da", words)).toBe("Nicolai har noget lige før.");
    expect(backToBackNote([nicolai, me], "me", "da", words)).toBe(
      "Du og Nicolai har noget lige før.",
    );
    expect(backToBackNote([], "me", "da", words)).toBeNull();
  });
});
