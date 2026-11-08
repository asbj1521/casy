/** phoneBusy.ts, for PhoneBusy.swift. */
import { busySpan, phoneBusy, type PhoneEvent, type PhoneRead, phoneWindow } from "@/lib/phoneBusy";

import { caseBook, type ParityCase } from "./cases";

const NOW = Date.UTC(2026, 9, 7, 8);
const HOUR = 3_600_000;

export function phoneBusyCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261112);
  const flag = (odds: number) => random() < odds;
  const day = () =>
    `2026-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`;
  const event = (calendarId: string): PhoneEvent => {
    const base = {
      calendarId,
      free: flag(0.2),
      cancelled: flag(0.1),
      declined: flag(0.1),
    };
    if (flag(0.3)) {
      const startDay = day();
      const endDay = pick([day(), startDay, "not a day", "2026-13-45"]);
      return { ...base, allDay: true, startDay, endDay };
    }
    const start = NOW + int(-20 * 24, 400 * 24) * HOUR + int(0, 3) * 900_000;
    return { ...base, allDay: false, start, end: start + int(-1, 6) * 1_800_000 };
  };

  for (let i = 0; i < 200; i++) {
    const e = event("c");
    add("busySpan", { event: e }, busySpan(e));
  }
  for (const now of [NOW, Date.UTC(2026, 2, 29, 12)]) add("phoneWindow", { now }, phoneWindow(now));

  for (let i = 0; i < 60; i++) {
    const calendars = Array.from({ length: int(1, 5) }, (_, n) => ({
      id: `c${n}`,
      name: pick(["Calendar", "Work", "Skole", "Calendar"]),
      account: pick(["iCloud", "a@example.com", ""]),
      subscribed: flag(0.3),
      writable: flag(0.5),
    }));
    const read: PhoneRead = {
      calendars,
      events: Array.from({ length: int(0, 30) }, () => event(pick(calendars).id)),
    };
    const window = phoneWindow(NOW);
    add("phoneBusy", { read, window }, phoneBusy(read, window));
  }

  // Blocks that touch end to start, overlap, sit inside one another, start
  // together, or lie across the window's edges: what merging has to get right.
  const timed = (start: number, end: number): PhoneEvent => ({
    calendarId: "c",
    allDay: false,
    free: false,
    cancelled: false,
    declined: false,
    start: NOW + start * HOUR,
    end: NOW + end * HOUR,
  });
  const window = phoneWindow(NOW);
  const calendars = [{ id: "c", name: "Calendar", account: "", subscribed: false, writable: true }];
  for (const spans of [
    [
      [1, 2],
      [2, 3],
    ],
    [
      [2, 3],
      [1, 2],
    ],
    [
      [1, 3],
      [2, 4],
    ],
    [
      [1, 6],
      [2, 3],
      [6, 7],
    ],
    [
      [1, 2],
      [1, 4],
    ],
    [
      [1, 2],
      [3, 4],
    ],
    [
      [-400, -167],
      [-168, -167],
    ],
    [[8000, 9000]],
  ]) {
    const read = { calendars, events: spans.map(([a, b]) => timed(a, b)) };
    add("phoneBusy", { read, window }, phoneBusy(read, window));
  }
  return cases;
}
