import { useQuery } from "@tanstack/react-query";

import { calendarBusyQuery } from "@/api/calendars";
import { eventsQuery, needsYourAnswer, type SuggestedEvent } from "@/api/events";
import { useAuth } from "@/context/auth";
import { cantMake } from "@/lib/eventConflicts";
import { isEventSettings, SEARCH_WINDOW } from "@/lib/eventSearch";
import { withHolidayBlocks } from "@/lib/holidayBlocks";
import { busyFromCalendars } from "@/lib/realCalendar";
import { APP_TIME_ZONE } from "@/lib/zone";

/** A date waiting for answers that you said yes to. */
function acceptedPending(event: SuggestedEvent): boolean {
  return (
    event.status === "pending" &&
    !!event.currentDate &&
    event.invitees.some((i) => i.isYou && i.response === "accepted")
  );
}

/**
 * The number on My events, in the header and the tab bar alike: the dates
 * waiting for your answer, and the ones you said yes to that your own
 * calendar now rules out (#85), so a clash is noticed without opening the
 * page. Only someone with such a date has their own calendar read for it.
 */
export function useEventsBadge(): number | undefined {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { data: events } = useQuery({ ...eventsQuery(userId), enabled: !!user });
  const toCheck = events?.filter(acceptedPending) ?? [];
  const { data: mine } = useQuery({
    ...calendarBusyQuery(userId, SEARCH_WINDOW.start, SEARCH_WINDOW.end),
    enabled: !!user && toCheck.length > 0,
  });
  if (!events) return undefined;

  // You, as the engine sees you in a group: your counted calendars, plus
  // the days nobody is free (holidayBlocks.ts).
  const you = mine
    ? withHolidayBlocks(
        [{ profileId: userId, name: "", busy: busyFromCalendars(mine) }],
        APP_TIME_ZONE,
      )
    : null;
  return events.filter(
    (e) =>
      needsYourAnswer(e) ||
      (!!you &&
        acceptedPending(e) &&
        isEventSettings(e.settings) &&
        cantMake(you, e.settings, e.currentDate!, APP_TIME_ZONE).length > 0),
  ).length;
}
