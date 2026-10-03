import { useT } from "@/i18n/lang";

/** Where calendars are connected and managed (CalendarAccounts), opened from My calendar. */
export const CALENDAR_ACCOUNTS_PATH = "/calendar-overview/accounts";

/**
 * Whether a link is someone arriving to connect calendars: back from Google
 * or Outlook (?connected, ?error), or new from sign-in (?onboarding). The
 * OAuth callbacks still return to /profile, which passes these on to
 * CALENDAR_ACCOUNTS_PATH.
 */
export function isCalendarArrival(params: URLSearchParams): boolean {
  return params.has("connected") || params.has("error") || params.has("onboarding");
}

/**
 * Where every "connect a calendar" link and every help guide's way back
 * leads, and what a link back there says.
 */
export function useCalendarsHome(): { to: string; back: string } {
  const t = useT();
  return { to: CALENDAR_ACCOUNTS_PATH, back: t.calendarAccounts.back };
}
