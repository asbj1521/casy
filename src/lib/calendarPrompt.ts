/**
 * When a computer asks someone with no calendar to connect one
 * (ConnectCalendarPrompt). Without a calendar, nothing of theirs is searched:
 * a real group's dates are found without them, so the question comes back
 * once per visit until they connect one.
 */
import type { CalendarConnectionStatus } from "@/api/calendars";
import { readStored, writeStored } from "@/lib/storage";
import type { CalendarProvider } from "@/types";

/**
 * The pages it may open on: the ones a signed-in person uses Casy from.
 * Never where a calendar is being connected, nor on sign-in, an invite link,
 * the help guides or the privacy policy, which someone is there to read.
 */
export function promptsOnPage(pathname: string): boolean {
  return (
    ["/", "/plan", "/events", "/calendar-overview", "/profile", "/groups"].includes(pathname) ||
    pathname.startsWith("/groups/")
  );
}

/** At least one account is linked and working (a failed or half-made one doesn't count). */
export function hasConnectedCalendar(connections: CalendarConnectionStatus[]): boolean {
  return connections.some((c) => c.status === "connected");
}

/**
 * Whether to ask now. `connections` must be an answer fetched on this visit:
 * the copy remembered from an earlier one (queryPersistence.ts) may predate a
 * calendar connected since, on this device or another.
 */
export function shouldPromptForCalendar({
  pathname,
  connections,
  dismissed,
}: {
  pathname: string;
  /** This visit's answer from calendar-status; undefined until it arrives. */
  connections: CalendarConnectionStatus[] | undefined;
  dismissed: boolean;
}): boolean {
  return (
    !dismissed && promptsOnPage(pathname) && !!connections && !hasConnectedCalendar(connections)
  );
}

/**
 * Closed on this visit, however it was closed (not now, or a provider picked).
 * Session storage: kept across reloads in the tab, gone when Casy is opened
 * anew, which is when it asks again.
 */
const dismissedKey = (userId: string) => `casy-calendar-prompt-dismissed:${userId}`;

export function isCalendarPromptDismissed(userId: string): boolean {
  return readStored(dismissedKey(userId), "session") === "1";
}

export function dismissCalendarPrompt(userId: string): void {
  writeStored(dismissedKey(userId), "1", "session");
}

/** The address parameter that opens the calendars page with one provider ready. */
export const CONNECT_PARAM = "connect";

const PROVIDERS: readonly CalendarProvider[] = ["apple", "google", "outlook", "ics"];

/** The provider a link asked to have ready (?connect=apple), if it named a real one. */
export function readyProvider(params: URLSearchParams): CalendarProvider | null {
  const asked = params.get(CONNECT_PARAM);
  return PROVIDERS.find((p) => p === asked) ?? null;
}
