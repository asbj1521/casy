/**
 * Your calendars: the accounts you linked, their busy time, how each calendar
 * counts, and the primary calendar Casy adds agreed events to. Every
 * calendar Edge Function is called from here, and every one of them answers
 * only for the signed-in caller; `userId` below only keys the cache, so one
 * person's answer is never served to the next.
 */
import { queryOptions, type QueryClient } from "@tanstack/react-query";

import { currentMessages } from "@/i18n/current";
import type { OverviewData } from "@/lib/calendarOverview";
import type { PhoneCalendarPush } from "@/lib/phoneBusy";
import { callFunction } from "@/lib/supabaseFunctions";
import type { CalendarPriority, CalendarProvider, CalendarPurpose } from "@/types";

/** One calendar discovered within a connected account (see calendar_sources). */
export interface CalendarSourceStatus {
  id: string;
  /** The provider's own name for it, saved when the account was connected. */
  display_name: string | null;
  /** The name its owner gave it on My calendar. */
  custom_name: string | null;
  purpose: CalendarPurpose | null;
  priority: CalendarPriority;
  /** Casy may add events to it, so it can be the primary calendar. */
  writable: boolean;
}

/** A linked account's real, persisted state: what calendar-status returns. */
export interface CalendarConnectionStatus {
  id: string;
  provider: CalendarProvider;
  status: "pending" | "connected" | "error";
  account_label: string | null;
  error_message: string | null;
  created_at: string;
  /** When busy times were last fetched successfully. */
  last_synced_at: string | null;
  /** When a sync last tried, successful or not. */
  last_sync_attempt_at: string | null;
  /** Why the latest sync failed, written for the person; null when it worked. */
  sync_error: string | null;
  /** The provider refused the stored access; only reconnecting helps. */
  needs_reconnect: boolean;
  calendar_sources: CalendarSourceStatus[];
  busyCount: number;
}

/**
 * Every account you linked, newest first. Held for a minute: it only changes
 * when you connect, remove or sync, and each of those refetches it
 * (calendarsChanged). The nav warms it the moment someone heads for the
 * profile page, which is most of the wait gone before the page mounts.
 */
export function calendarStatusQuery(userId: string) {
  return queryOptions({
    queryKey: ["calendar-status", userId],
    queryFn: async (): Promise<CalendarConnectionStatus[]> => {
      const body = await callFunction<{ connections?: CalendarConnectionStatus[] }>(
        "calendar-status",
        { errorMessage: currentMessages().api.loadStatus },
      );
      return body.connections ?? [];
    },
    staleTime: 60_000,
  });
}

/** Your own calendars and their busy blocks between two instants (ISO). */
export function calendarBusyQuery(userId: string, from: string, to: string) {
  return queryOptions({
    queryKey: ["calendar-busy", userId, from, to],
    queryFn: () =>
      callFunction<OverviewData>("calendar-busy", {
        params: { from, to },
        errorMessage: currentMessages().api.loadCalendars,
      }),
    staleTime: 60_000,
  });
}

/**
 * After anything that changes your calendars or how they count: every answer
 * built from them is fetched again, the ones on screen at once and the rest
 * when next shown. Your groups' searches read them through the groups
 * function, so those go too.
 */
export async function calendarsChanged(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    ["calendar-status", "calendar-busy", "group-busy"].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  );
}

/** One change to one calendar, as My calendar makes them. */
export type CalendarChange =
  | { purpose: CalendarPurpose | null }
  | { priority: CalendarPriority }
  | { included: boolean }
  /** A name of its owner's, or null to go back to the provider's own. */
  | { name: string | null };

export async function updateCalendar(calendarId: string, change: CalendarChange): Promise<void> {
  const words = currentMessages().calendarView;
  await callFunction("calendar-set-purpose", {
    body: { calendarId, ...change },
    errorMessage:
      "purpose" in change
        ? words.couldntSaveCategory
        : "priority" in change
          ? words.couldntSavePriority
          : "included" in change
            ? words.couldntSaveIncluded
            : words.couldntSaveName,
  });
}

/**
 * Google and Outlook connect through their own consent screens. The page asks
 * for the screen's address with the login attached (a plain link can't carry
 * it), and the browser goes there; the server ties the link to you.
 */
export async function consentScreenUrl(provider: "google" | "outlook"): Promise<string> {
  const { url } = await callFunction<{ url: string }>(`oauth-${provider}-start`, {
    body: {},
    errorMessage: currentMessages().profile.couldntStartConnect,
  });
  return url;
}

/** What connecting iCloud found in the account. */
export interface AppleConnectResult {
  connectionId: string;
  /** The Apple Account email, which is what the profile page lists the account as. */
  label: string;
  calendars: number;
  busyBlocks: number;
  /** Events Apple sent that couldn't be read, and were left out. */
  skippedEvents: number;
}

/**
 * Sign in to iCloud with an app-specific password and copy the account's busy
 * times. Two places connect one: the Apple card's quick form on the profile
 * page and the step-by-step setup at /help/connect-icloud. The calendar list
 * is refetched before this returns, so the new account is listed the moment
 * the form closes.
 */
export async function connectApple(
  queryClient: QueryClient,
  username: string,
  password: string,
): Promise<AppleConnectResult> {
  const result = await callFunction<AppleConnectResult>("calendar-add-apple", {
    body: { username, password },
    errorMessage: currentMessages().profile.couldntIcloud,
  });
  await calendarsChanged(queryClient);
  return result;
}

/** Add a calendar by its link (a timetable, a shared feed). */
export async function addCalendarLink(
  queryClient: QueryClient,
  url: string,
  name: string,
): Promise<{ label: string; busyBlocks: number }> {
  const result = await callFunction<{ label: string; busyBlocks: number }>("calendar-add-ics", {
    body: { url, name },
    errorMessage: currentMessages().profile.couldntAddLink,
  });
  await calendarsChanged(queryClient);
  return result;
}

/** A push of the phone's calendars, as calendar-phone answers it. */
export type PhonePushResult =
  | { gone: true }
  | {
      gone?: false;
      connectionId: string;
      calendars: number;
      busyBlocks: number;
      /** Asked for with `issueToken`: the phone's own token for the background refresh. */
      deviceToken?: string;
    };

/**
 * Send the phone's calendars and busy blocks (the iPhone app only; see
 * usePhoneCalendarSync). `create` makes the connection if there is none;
 * without it, a connection removed since answers `{ gone: true }`.
 */
export async function pushPhoneCalendars(body: {
  deviceId: string;
  label: string;
  create: boolean;
  /** Hand back a new device token (the native side has none). */
  issueToken: boolean;
  calendars: PhoneCalendarPush[];
}): Promise<PhonePushResult> {
  return await callFunction<PhonePushResult>("calendar-phone", {
    body,
    errorMessage: currentMessages().phoneCalendar.couldntSave,
  });
}

/**
 * Remove one linked account and everything synced from it. Removing the
 * account that holds the primary calendar clears that choice too.
 */
export async function disconnectCalendar(
  queryClient: QueryClient,
  connectionId: string,
): Promise<void> {
  await callFunction("calendar-disconnect", {
    body: { connectionId },
    errorMessage: currentMessages().profile.couldntRemove,
  });
  void queryClient.invalidateQueries({ queryKey: ["primary-calendar"] });
  await calendarsChanged(queryClient);
}

/**
 * Fetch every connected account's busy times now, instead of waiting for the
 * hourly run. An account synced in the last minute is left alone by the
 * server, and isn't among the results.
 */
export async function syncMyCalendars(queryClient: QueryClient): Promise<{ ok: boolean }[]> {
  const { results } = await callFunction<{ results: { ok: boolean }[] }>("calendar-sync", {
    body: {},
    errorMessage: currentMessages().profile.couldntSync,
  });
  // A sync also notices entries deleted from the calendar by hand (My events).
  void queryClient.invalidateQueries({ queryKey: ["events"] });
  await calendarsChanged(queryClient);
  return results;
}

/* ----------------------------------------------------------------------------
 * The primary calendar: which of your calendars Casy adds agreed events to,
 * and whether it does so automatically. Only calendars Casy may write to can
 * be chosen (for now, iCloud calendars of your own). Kept as its own query,
 * next to calendar-status rather than inside it.
 * ------------------------------------------------------------------------- */

export interface PrimaryCalendar {
  /** A calendar_sources id, as calendar-status and calendar-busy list them. */
  calendarId: string;
  /** Add every event as soon as everyone has accepted, without a click. */
  autoAdd: boolean;
}

const primaryCalendarKey = (userId: string) => ["primary-calendar", userId] as const;

/** Your primary calendar, or null if you haven't chosen one. */
export function primaryCalendarQuery(userId: string) {
  return queryOptions({
    queryKey: primaryCalendarKey(userId),
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
  queryClient.setQueryData(primaryCalendarKey(userId), primary);
  return primary;
}
