import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";

import { eventsQuery, type EventResponse, type SuggestedEvent } from "@/api/events";
import type { MonthViewHandle } from "@/components/swipe/MonthView";
import { useSignedInUser } from "@/context/auth";
import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { useIsDark } from "@/hooks/useIsDark";
import { eventTitle } from "@/i18n/eventTitle";
import { useT } from "@/i18n/lang";
import { flyIntoDay } from "@/lib/dateFlight";
import {
  CASY_CALENDAR,
  CASY_RGB,
  casyOnDay,
  newlyDecided,
  pencilItems,
  scheduledItems,
  waitingVotes,
} from "@/lib/homeVotes";
import { sectionEvents } from "@/lib/myEvents";
import { readStored, writeStored } from "@/lib/storage";
import { shade, tint } from "@/lib/tint";
import { isVote } from "@/lib/vote";
import { APP_TIME_ZONE, startOfDay } from "@/lib/zone";

const TZ = APP_TIME_ZONE;
/** The decided events this device has seen land in their day (ids, JSON). */
const SEEN_KEY = "casy-decided-seen";
/** After a date has landed, before the next one is said. */
const SETTLE_MS = 1500;
/** The month gliding to the day before the date flies into it. */
const GLIDE_FIRST_MS = 650;

const NO_EVENTS: SuggestedEvent[] = [];
const NO_STAMPS: ReadonlyMap<number, EventResponse> = new Map();

function readSeen(): ReadonlySet<string> | null {
  const raw = readStored(SEEN_KEY);
  if (raw === null) return null;
  try {
    const ids: unknown = JSON.parse(raw);
    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

/**
 * Casy's own events on the home page's month (#172): the dates of the votes
 * waiting for your answer pencilled into their days, the events decided as
 * chips in Casy's orange, and, while a vote is answered over the month, the
 * day being answered lit and your answers stamped into their days. Each
 * event decided since this device last looked is said once the home page is
 * free to show it (`idle`): `agreed`, for AgreedCard over the month, whose
 * closing flies the date into its day (`flyIn`), with confetti as it lands.
 * Its chip waits for it to land. On a device's first visit everything
 * already decided counts as seen.
 */
export function useHomeVotes({
  calendar,
  months,
  idle,
}: {
  calendar: MyCalendarDays;
  months: RefObject<MonthViewHandle | null>;
  /** Nothing over the month: no sheet, no vote, no open day. */
  idle: boolean;
}) {
  const t = useT();
  const dark = useIsDark();
  const userId = useSignedInUser().id;
  const { data, isSuccess } = useQuery(eventsQuery(userId));
  const events = data ?? NO_EVENTS;
  const titleOf = useCallback((e: SuggestedEvent) => eventTitle(e.title, t), [t]);

  const waiting = useMemo(() => waitingVotes(events), [events]);
  const pencils = useMemo(() => pencilItems(waiting, titleOf), [waiting, titleOf]);

  // What this device has seen land: null until known, on a first visit
  // everything decided by then (React's pattern for state set from data).
  const [seen, setSeen] = useState(readSeen);
  if (seen === null && isSuccess) {
    setSeen(new Set(sectionEvents(events).scheduled.map((e) => e.id)));
  }
  useEffect(() => {
    if (seen) writeStored(SEEN_KEY, JSON.stringify([...seen]));
  }, [seen]);
  const unseen = useMemo(() => (seen ? newlyDecided(events, seen) : []), [events, seen]);

  const items = useMemo(() => {
    const flying = new Set(unseen.map((e) => e.id));
    const decided = scheduledItems(
      events.filter((e) => !flying.has(e.id)),
      calendar.items,
      titleOf,
    );
    return [...pencils, ...decided];
  }, [events, unseen, pencils, calendar.items, titleOf]);
  const calendarColor = calendar.colorOf;
  const colorOf = useCallback(
    (id: string) => (id === CASY_CALENDAR ? CASY_RGB : calendarColor(id)),
    [calendarColor],
  );

  // While a vote is answered over the month: its day and your answers.
  const [view, setView] = useState<{
    lit: number | null;
    stamps: ReadonlyMap<number, EventResponse>;
  }>({ lit: null, stamps: NO_STAMPS });
  const showDay = useCallback(
    (day: number, clear: number) => months.current?.glideToDay(day, clear),
    [months],
  );

  // The next date agreed since this device last looked: said over the month
  // (AgreedCard) once nothing else is over it, then flown into its day.
  const [flying, setFlying] = useState(false);
  const [celebrations, setCelebrations] = useState(0);
  const next = unseen.find((e) => e.currentDate !== null);
  const agreed =
    next && next.currentDate && idle && !flying ? { ...next, currentDate: next.currentDate } : null;

  /** The card closed: the month glides to the day, and the date flies there from `from`. */
  function flyIn(from: DOMRect) {
    if (!next?.currentDate) return;
    const id = next.id;
    const day = startOfDay(Date.parse(next.currentDate.start), TZ);
    const label = titleOf(next);
    setFlying(true);
    months.current?.glideToDay(day, 0);
    window.setTimeout(() => {
      flyIntoDay({
        from,
        day,
        label,
        colors: {
          background: `rgb(${tint(CASY_RGB, dark)})`,
          color: `rgb(${shade(CASY_RGB, dark)})`,
        },
        onLand: () => {
          setSeen((s) => new Set([...(s ?? []), id]));
          setCelebrations((n) => n + 1);
          // A moment to see it settle before the next agreed date is said.
          window.setTimeout(() => setFlying(false), SETTLE_MS);
        },
      });
    }, GLIDE_FIRST_MS);
  }

  /** Casy's events on a day, for its list. */
  const onDay = useCallback(
    (day: number) => casyOnDay(events, day, (iso) => startOfDay(Date.parse(iso), TZ)),
    [events],
  );

  const voteById = useCallback(
    (id: string | null) => {
      const event = id ? events.find((e) => e.id === id) : undefined;
      return event && isVote(event) ? event : null;
    },
    [events],
  );

  return {
    waiting,
    items,
    colorOf,
    voteById,
    onDay,
    view,
    setView,
    showDay,
    agreed,
    flyIn,
    celebrations,
  };
}
