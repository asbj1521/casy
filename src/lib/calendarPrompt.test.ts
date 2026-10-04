import { describe, expect, it } from "vitest";

import type { CalendarConnectionStatus } from "@/api/calendars";
import { promptsOnPage, readyProvider, shouldPromptForCalendar } from "@/lib/calendarPrompt";

function connection(status: CalendarConnectionStatus["status"]): CalendarConnectionStatus {
  return {
    id: `c-${status}`,
    provider: "google",
    status,
    account_label: null,
    error_message: null,
    created_at: "2026-10-01T10:00:00.000Z",
    last_synced_at: null,
    last_sync_attempt_at: null,
    sync_error: null,
    needs_reconnect: false,
    calendar_sources: [],
    busyCount: 0,
  };
}

describe("promptsOnPage", () => {
  it("asks on the pages a signed-in person uses Casy from", () => {
    for (const path of [
      "/",
      "/plan",
      "/events",
      "/groups",
      "/groups/abc",
      "/calendar-overview",
      "/profile",
    ]) {
      expect(promptsOnPage(path)).toBe(true);
    }
  });

  it("never where calendars are connected, nor on sign-in, invites or reading pages", () => {
    for (const path of [
      "/calendar-overview/accounts",
      "/sign-in",
      "/join/token",
      "/help/connect-icloud",
      "/privacy",
      "/how-it-works",
      "/groupsx",
    ]) {
      expect(promptsOnPage(path)).toBe(false);
    }
  });
});

describe("shouldPromptForCalendar", () => {
  const base = { pathname: "/", dismissed: false };

  it("asks when no account is connected", () => {
    expect(shouldPromptForCalendar({ ...base, connections: [] })).toBe(true);
    expect(
      shouldPromptForCalendar({
        ...base,
        connections: [connection("error"), connection("pending")],
      }),
    ).toBe(true);
  });

  it("doesn't once one is connected", () => {
    expect(
      shouldPromptForCalendar({
        ...base,
        connections: [connection("error"), connection("connected")],
      }),
    ).toBe(false);
  });

  it("waits for this visit's answer", () => {
    expect(shouldPromptForCalendar({ ...base, connections: undefined })).toBe(false);
  });

  it("stays closed once dismissed, and off other pages", () => {
    expect(shouldPromptForCalendar({ ...base, dismissed: true, connections: [] })).toBe(false);
    expect(shouldPromptForCalendar({ ...base, pathname: "/sign-in", connections: [] })).toBe(false);
  });
});

describe("readyProvider", () => {
  it("reads a real provider from the address", () => {
    expect(readyProvider(new URLSearchParams("connect=apple"))).toBe("apple");
    expect(readyProvider(new URLSearchParams("connect=ics"))).toBe("ics");
  });

  it("ignores anything else", () => {
    expect(readyProvider(new URLSearchParams(""))).toBe(null);
    expect(readyProvider(new URLSearchParams("connect=yahoo"))).toBe(null);
  });
});
