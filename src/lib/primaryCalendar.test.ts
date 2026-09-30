import { describe, expect, it } from "vitest";

import type { CalendarConnectionStatus, CalendarSourceStatus } from "@/api/calendarStatus";
import { primaryName, primaryOptions } from "@/lib/primaryCalendar";

const source = (
  id: string,
  name: string,
  writable: boolean,
  custom?: string,
): CalendarSourceStatus => ({
  id,
  display_name: name,
  custom_name: custom ?? null,
  purpose: null,
  writable,
});

const connection = (
  id: string,
  label: string,
  sources: CalendarSourceStatus[],
  status: CalendarConnectionStatus["status"] = "connected",
): CalendarConnectionStatus => ({
  id,
  provider: "apple",
  status,
  account_label: label,
  error_message: null,
  created_at: "2026-09-28T12:00:00Z",
  last_synced_at: null,
  last_sync_attempt_at: null,
  sync_error: null,
  needs_reconnect: false,
  calendar_sources: sources,
  busyCount: 0,
});

describe("primaryOptions", () => {
  it("offers only calendars Casy may write to, grouped by account", () => {
    const options = primaryOptions(
      [
        connection("a", "me@icloud.com", [source("1", "Home", true), source("2", "Shared", false)]),
        connection("b", "me@gmail.com", [source("3", "me@gmail.com", false)]),
      ],
      null,
    );
    expect(options).toEqual([{ account: "me@icloud.com", calendars: [{ id: "1", name: "Home" }] }]);
  });

  it("uses the name its owner gave a calendar", () => {
    const options = primaryOptions(
      [connection("a", "me@icloud.com", [source("1", "Calendar", true, "Football")])],
      null,
    );
    expect(options[0].calendars[0].name).toBe("Football");
  });

  it("keeps the current primary calendar even if it is no longer writable", () => {
    const options = primaryOptions(
      [connection("a", "me@icloud.com", [source("1", "Home", false), source("2", "Work", false)])],
      "1",
    );
    expect(options[0].calendars.map((c) => c.id)).toEqual(["1"]);
  });

  it("leaves out accounts that are not connected", () => {
    const options = primaryOptions(
      [connection("a", "me@icloud.com", [source("1", "Home", true)], "error")],
      null,
    );
    expect(options).toEqual([]);
  });
});

describe("primaryName", () => {
  const connections = [connection("a", "me@icloud.com", [source("1", "Home", true, "Family")])];

  it("finds the primary calendar's name", () => {
    expect(primaryName(connections, "1")).toBe("Family");
  });

  it("is null when nothing is chosen or the calendar is gone", () => {
    expect(primaryName(connections, null)).toBeNull();
    expect(primaryName(connections, "gone")).toBeNull();
  });
});
