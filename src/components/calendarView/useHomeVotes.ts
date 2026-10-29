import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
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
/** Casy's orange, as the month's calendar colours are written. */
const CASY_RGB = "234, 88, 12";
/** The decided events this device has seen land in their day (ids, JSON). */
const SEEN_KEY = "casy-decided-seen";
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
 * event decided since this device last looked flies into its day once the
 * home page is free to show it (`idle`): from where its card was, if your
 * own answer settled it (`settledHere`, with confetti as it lands), or else
 * from the Aftaler button. Its chip waits for it to land. On a device's
 * first visit everything already decided counts as seen.
 */
export function useHomeVotes({
  calendar,
  months,
  eventsButton,
  idle,
}: {
  calendar: MyCalendarDays;
  months: RefObject<MonthViewHandle | null>;
  eventsButton: RefObject<HTMLElement | null>;
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

  // Where the card was when your own answer settled a date, by event.
  const settledFrom = useRef(new Map<string, DOMRect>());
  const settledHere = useCallback((eventId: string, from: DOMRect) => {
    settledFrom.current.set(eventId, from);
  }, []);
  const [celebrations, setCelebrations] = useState(0);

  // One date at a time flies into its day, once nothing is over the month.
  const next = unseen.find((e) => e.currentDate !== null);
  const flying = useRef(false);
  useEffect(() => {
    if (!next?.currentDate || !idle || flying.current) return;
    const id = next.id;
    const day = startOfDay(Date.parse(next.currentDate.start), TZ);
    const label = titleOf(next);
    let started = false;
    flying.current = true;
    months.current?.glideToDay(day, 0);
    const timer = window.setTimeout(() => {
      started = true;
      const mine = settledFrom.current.get(id);
      const from =
        mine ??
        eventsButton.current?.getBoundingClientRect() ??
        new DOMRect(window.innerWidth / 2, window.innerHeight, 0, 0);
      flyIntoDay({
        from,
        day,
        label,
        colors: {
          background: `rgb(${tint(CASY_RGB, dark)})`,
          color: `rgb(${shade(CASY_RGB, dark)})`,
        },
        onLand: () => {
          flying.current = false;
          settledFrom.current.delete(id);
          setSeen((s) => new Set([...(s ?? []), id]));
          if (mine) setCelebrations((n) => n + 1);
        },
      });
    }, GLIDE_FIRST_MS);
    return () => {
      window.clearTimeout(timer);
      // Once in the air it lands by itself; before that it waits for the next chance.
      if (!started) flying.current = false;
    };
  }, [next, idle, months, eventsButton, titleOf, dark]);

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
    view,
    setView,
    showDay,
    settledHere,
    celebrations,
  };
}
