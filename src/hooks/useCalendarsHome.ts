import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";

/** The phone's screen for connecting and managing calendars (CalendarAccounts). */
export const CALENDAR_ACCOUNTS_PATH = "/calendar-overview/accounts";

/**
 * Where connecting calendars happens, for every "connect a calendar" link and
 * every help guide's way back: the profile page on a computer, the Calendar
 * tab's own screen on a phone. `back` is what a link back there says.
 */
export function useCalendarsHome(): { to: string; back: string } {
  const t = useT();
  return usePhoneLayout()
    ? { to: CALENDAR_ACCOUNTS_PATH, back: t.calendarAccounts.back }
    : { to: "/profile", back: t.calendarView.back };
}
