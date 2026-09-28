/**
 * The primary calendar: which of your calendars Casy adds agreed events to,
 * and whether it does so automatically. Backed by the calendar-primary Edge
 * Function; only calendars Casy may write to can be chosen (for now, iCloud
 * calendars that are your own).
 *
 * Kept apart from calendar-status on purpose: that answer is remembered in
 * the browser in its current shape (queryPersistence.ts), and this one is
 * remembered next to it rather than changing it.
 */
import { queryOptions, type QueryClient } from "@tanstack/react-query";

import { currentMessages } from "@/i18n/current";
import { callFunction } from "@/lib/supabaseFunctions";

export interface PrimaryCalendar {
  /** A calendar_sources id, as calendar-status and calendar-busy list them. */
  calendarId: string;
  /** Add every event as soon as everyone has accepted, without a click. */
  autoAdd: boolean;
}

export function primaryCalendarQueryKey(userId: string) {
  return ["primary-calendar", userId] as const;
}

/** Your primary calendar, or null if you haven't chosen one. */
export function primaryCalendarQuery(userId: string) {
  return queryOptions({
    queryKey: primaryCalendarQueryKey(userId),
    queryFn: async (): Promise<PrimaryCalendar | null> => {
      const body = await callFunction<{ primary?: PrimaryCalendar | null }>("calendar-primary", {
        body: { action: "get" },
        errorMessage: currentMessages().api.loadPrimaryCalendar,
      });
      return body.primary ?? null;
    },
    staleTime: 60_000,
  });
}

/**
 * Make a calendar primary (null clears the choice), or switch adding
 * automatically on or off. Either way the function answers with the new
 * choice, which goes straight into the cache.
 */
export async function updatePrimaryCalendar(
  queryClient: QueryClient,
  userId: string,
  change: { calendarId: string | null } | { autoAdd: boolean },
): Promise<PrimaryCalendar | null> {
  const words = currentMessages().api;
  const body = await callFunction<{ primary?: PrimaryCalendar | null }>("calendar-primary", {
    body:
      "calendarId" in change
        ? { action: "set", calendarId: change.calendarId }
        : { action: "auto-add", autoAdd: change.autoAdd },
    errorMessage: "calendarId" in change ? words.setPrimaryCalendar : words.setAutoAdd,
  });
  const primary = body.primary ?? null;
  queryClient.setQueryData(primaryCalendarQueryKey(userId), primary);
  return primary;
}
