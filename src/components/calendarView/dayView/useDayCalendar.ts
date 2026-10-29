import { useCallback, useEffect, useMemo, useRef } from "react";

import type { Pencil } from "@/components/swipe/DayColumns";
import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { eventTitle } from "@/i18n/eventTitle";
import { useT } from "@/i18n/lang";
import type { DaySegment } from "@/lib/calendarOverview";
import { CASY_CALENDAR_ID } from "@/lib/casyEntries";
import { segmentOnDay } from "@/lib/dayView";
import { CASY_CALENDAR, type casyOnDay } from "@/lib/homeVotes";
import { isPending, markOn, type TripMark } from "@/lib/tripView";
import { upcomingDates, type VoteEvent } from "@/lib/vote";
import { APP_TIME_ZONE, startOfDay } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/** What a tap on one of Casy's own blocks opens, and what it is called. */
interface CasyBlock {
  label: string;
  open: () => void;
}

/**
 * Your calendar as the day view draws it (#176): your calendars' own blocks,
 * and Casy's beside them as blocks of the same kind, so they are drawn and
 * tapped alike: the agreed events you are going to in Casy's orange (left
 * out where your calendar already holds the copy Casy wrote, as the month
 * does), an accepted trip across the whole day, and the dates of the votes
 * waiting for you pencilled in. `actionOf` says what a tap on a block opens
 * when it is Casy's; your own blocks open their details.
 */
export function useDayCalendar({
  month,
  casyOn,
  waiting,
  marks,
  onEvents,
  onVote,
  onTrip,
}: {
  /** The month's calendar, Casy's colour already in it. */
  month: MyCalendarDays;
  /** Casy's own events on a day (useHomeVotes' `onDay`). */
  casyOn: (day: number) => ReturnType<typeof casyOnDay>;
  waiting: VoteEvent[];
  marks: TripMark[];
  onEvents: () => void;
  onVote: (id: string) => void;
  onTrip: (mark: TripMark) => void;
}) {
  const t = useT();
  // Casy's blocks are made afresh on each read, so they are told apart by
  // the block itself, not an id: forgotten as soon as nothing draws them.
  const casyBlocks = useRef(new WeakMap<DaySegment, CasyBlock>());
  // The latest openers, so the calendar handed down stays the same.
  const open = useRef({ onEvents, onTrip });
  useEffect(() => {
    open.current = { onEvents, onTrip };
  });

  const { segmentsOn: ownOn, labelOf: ownLabel } = month;
  const segmentsOn = useCallback(
    (date: Date) => {
      const day = startOfDay(date.getTime(), TZ);
      const own = ownOn(date);
      const casy: DaySegment[] = [];
      const mark = markOn(marks, day);
      if (mark && !isPending(mark)) {
        const seg = segmentOnDay(mark.start, mark.end, day, CASY_CALENDAR_ID);
        if (seg) {
          casy.push(seg);
          casyBlocks.current.set(seg, {
            label: t.trips.barAccepted(mark.city),
            open: () => open.current.onTrip(mark),
          });
        }
      }
      for (const c of casyOn(day)) {
        if (c.vote) continue;
        const start = Date.parse(c.start);
        const end = Date.parse(c.end);
        if (own.some((s) => s.start.getTime() === start && s.end.getTime() === end)) continue;
        const seg = segmentOnDay(start, end, day, CASY_CALENDAR);
        if (!seg) continue;
        casy.push(seg);
        casyBlocks.current.set(seg, {
          label: eventTitle(c.event.title, t),
          open: () => open.current.onEvents(),
        });
      }
      return casy.length === 0 ? own : [...casy, ...own];
    },
    [ownOn, casyOn, marks, t],
  );
  const labelOf = useCallback(
    (segment: DaySegment) => casyBlocks.current.get(segment)?.label ?? ownLabel(segment),
    [ownLabel],
  );
  const calendar = useMemo(() => ({ ...month, segmentsOn, labelOf }), [month, segmentsOn, labelOf]);
  const actionOf = useCallback((segment: DaySegment) => casyBlocks.current.get(segment)?.open, []);

  // The dates of the votes waiting for you, each opening its vote.
  const pencils = useMemo<Pencil[]>(
    () =>
      waiting.flatMap((v) =>
        upcomingDates(v).map((d) => ({
          key: `${v.id}/${d.id}`,
          start: Date.parse(d.start),
          end: Date.parse(d.end),
          label: eventTitle(v.title, t),
          onTap: () => onVote(v.id),
        })),
      ),
    [waiting, onVote, t],
  );

  return { calendar, actionOf, pencils };
}
