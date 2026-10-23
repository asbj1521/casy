import { useCallback, useMemo, useState } from "react";

import MonthView from "@/components/swipe/MonthView";
import TripSheet from "@/components/trips/TripSheet";
import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import type { Trips } from "@/hooks/useTrips";
import { useLang, useT } from "@/i18n/lang";
import { detectTrips, NO_ANSWERS, type Leg, type TripAnswers } from "@/lib/trips";
import { isPending, markOn, revealDay, tripBars, tripMarks, type TripMark } from "@/lib/tripView";
import { addDays, APP_TIME_ZONE, startOfDay } from "@/lib/zone";

/**
 * Dev-only (/dev/trips, never in a production build; see App.tsx): trip
 * detection (#115) as My calendar draws it, from made-up legs, since the real
 * thing needs the iPhone app, its calendars and the AI. The month glides to
 * the first trip waiting, its bar glows, a tap opens the sheet, and answers
 * are kept in memory. "Start over" forgets them. English only, since no
 * visitor ever sees it.
 */

const TZ = APP_TIME_ZONE;
const HOUR = 3_600_000;

/** `hour` o'clock `days` from today, Danish time. */
const day = (days: number, hour: number) => addDays(Date.now(), days, TZ) + hour * HOUR;

function madeUpLegs(): Leg[] {
  const leg = (
    id: string,
    from: string,
    to: string,
    start: number,
    mode: Leg["mode"] = "flight",
  ) => ({
    id,
    mode,
    from: from.toLowerCase(),
    to: to.toLowerCase(),
    start,
    end: start + 2 * HOUR,
    count: 1,
    names: { from, to },
  });
  return [
    // A clear round trip, waiting for a yes.
    leg("oslo-out", "Copenhagen", "Oslo", day(12, 10)),
    leg("oslo-back", "Oslo", "Copenhagen", day(16, 18)),
    // A train out with no way back: asked when you're home.
    leg("berlin-out", "Copenhagen", "Berlin", day(30, 8), "train"),
    // A third trip, so home is clear from the legs.
    leg("rome-out", "Copenhagen", "Rome", day(45, 7)),
    leg("rome-back", "Rome", "Copenhagen", day(50, 20)),
  ];
}

const NOOP = () => {};

export default function TripsPlayground() {
  const t = useT();
  const { lang } = useLang();
  const [legs] = useState(madeUpLegs);
  const [answers, setAnswers] = useState<TripAnswers>(NO_ANSWERS);
  const [now] = useState(() => Date.now());
  const [run, setRun] = useState(0);
  const detected = useMemo(() => detectTrips(legs, answers, now), [legs, answers, now]);
  const marks = useMemo(() => tripMarks(detected, lang), [detected, lang]);

  const calendar = useMemo(
    (): MyCalendarDays => ({
      loading: false,
      none: false,
      segmentsOn: () => [],
      colorOf: () => "234, 88, 12",
      labelOf: () => "",
      items: tripBars(marks, t.trips),
      calendars: [],
      entries: [],
      error: null,
      retry: NOOP,
      truncated: false,
    }),
    [marks, t],
  );

  const change = (update: (a: TripAnswers) => TripAnswers) => setAnswers(update);
  const trips: Trips = {
    detected,
    accept: (id) => change((a) => ({ ...a, accepted: [...a.accepted, id] })),
    decline: (id) =>
      change((a) => ({
        ...a,
        accepted: a.accepted.filter((x) => x !== id),
        dismissed: [...a.dismissed, id],
      })),
    answerReturn: (id, d) => change((a) => ({ ...a, returns: { ...a.returns, [id]: d } })),
    answerOutbound: (id, d) => change((a) => ({ ...a, outbounds: { ...a.outbounds, [id]: d } })),
    setHome: (city) => change((a) => ({ ...a, home: city })),
  };

  const [mark, setMark] = useState<TripMark | null>(null);
  const [open, setOpen] = useState(false);
  const pickDay = useCallback(
    (d: number) => {
      const found = markOn(marks, d);
      if (!found) return;
      setMark(found);
      setOpen(true);
    },
    [marks],
  );

  return (
    <div className="flex h-dvh flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-2 text-sm">
        <span className="font-semibold">Trips playground</span>
        <span className="text-muted-foreground">{marks.filter(isPending).length} waiting</span>
        <button
          type="button"
          className="text-primary"
          onClick={() => {
            setAnswers(NO_ANSWERS);
            setRun((n) => n + 1);
          }}
        >
          Start over
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <MonthView
          key={run}
          focus={startOfDay(now, TZ)}
          calendar={calendar}
          todayTone="grey"
          reveal={revealDay(marks)}
          onPickDay={pickDay}
        />
      </div>
      <TripSheet mark={mark} open={open} onClose={() => setOpen(false)} trips={trips} />
    </div>
  );
}
