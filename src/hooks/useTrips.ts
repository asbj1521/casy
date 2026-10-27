import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";

import { calendarBusyQuery, primaryCalendarQuery } from "@/api/calendars";
import { readTripLegs } from "@/api/tripLegs";
import { useAuth } from "@/context/auth";
import { useAiContent } from "@/hooks/useAiAllowed";
import { labelBookQuery } from "@/hooks/useEventLabels";
import { SEARCH_WINDOW } from "@/lib/eventSearch";
import { setTripStatus } from "@/lib/labelStatus";
import { isNativeApp } from "@/lib/nativeApp";
import { addTripToPhone, phoneConnectionId, phoneEventDetailsQuery } from "@/lib/phoneCalendar";
import {
  legBatches,
  casyTripSpans,
  phoneLegs,
  presentLegKeys,
  readLegBook,
  readTripAnswers,
  tidyLegBook,
  travelCandidates,
  writeLegBook,
  writeTripAnswers,
  type LegBook,
} from "@/lib/tripLegBook";
import { detectTrips, NO_ANSWERS, type Detected, type TripAnswers } from "@/lib/trips";
import { tripMarks, type TripMark } from "@/lib/tripView";
import { useLang, useT } from "@/i18n/lang";

/** The legs read from this phone's travel events, kept on the phone. */
export function legBookQuery(userId: string) {
  return queryOptions({
    queryKey: ["trip-legs", userId],
    queryFn: () => readLegBook(userId),
    staleTime: Infinity,
  });
}

/** What the person answered about their trips, kept on the phone. */
export function tripAnswersQuery(userId: string) {
  return queryOptions({
    queryKey: ["trip-answers", userId],
    queryFn: () => readTripAnswers(userId),
    staleTime: Infinity,
  });
}

/**
 * Whether My calendar has glided to a trip waiting for an answer (#115) since
 * the app was opened: once per launch, so it asks again next time without
 * pulling the month away on every visit (PhoneCalendar).
 */
export const tripReveal = { done: false };

/** Events asked about since the app was opened: each at most once, so a failing call isn't repeated in a loop. */
const askedThisLaunch = new Set<string>();

/** How the last trip-reading call went, kept for the status line after it goes idle. */
let lastTripRun = "none yet";

/** Start asking afresh, after the legs were deleted (the AI's consent withdrawn, #120). */
export function forgetAskedTrips(): void {
  askedThisLaunch.clear();
}

/** Whether trip detection runs here: the iPhone app, with a phone connected and the AI's yes. */
function useTripsOn(): { userId: string; phone: string | null; on: boolean } {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const phone = isNativeApp && userId ? phoneConnectionId(userId) : null;
  const allowed = useAiContent();
  return { userId, phone, on: !!phone && allowed };
}

/** This phone's calendars that count, by EventKit id, with their names. */
function useCountedPhoneCalendars(on: boolean, userId: string, phone: string | null) {
  const { data: busy } = useQuery({
    ...calendarBusyQuery(userId, SEARCH_WINDOW.start, SEARCH_WINDOW.end),
    enabled: on,
  });
  return useMemo(
    () =>
      busy
        ? new Map(
            busy.calendars
              .filter((c) => c.connectionId === phone && c.externalId && c.included)
              .map((c) => [c.externalId!, c.name]),
          )
        : null,
    [busy, phone],
  );
}

/**
 * Trip detection's background half (#115), mounted once in App.tsx: the
 * phone's events the labels call a flight or travel are read by `trip-legs`
 * (which way, between which cities), each distinct title and place once, and
 * the legs are kept on the phone. Runs again as new labels arrive. Only in
 * the iPhone app, for those who said yes to the AI using their calendar.
 */
export function useAutoTripLegs() {
  const { userId, phone, on } = useTripsOn();
  const queryClient = useQueryClient();
  const names = useCountedPhoneCalendars(on, userId, phone);
  const { data: events } = useQuery({
    ...phoneEventDetailsQuery(userId, SEARCH_WINDOW),
    enabled: on,
  });
  const { data: labels } = useQuery({ ...labelBookQuery(userId), enabled: on });
  const { data: book } = useQuery({ ...legBookQuery(userId), enabled: on });
  const running = useRef(false);

  useEffect(() => {
    // One line for testers in Your data: which condition holds, which doesn't.
    const flag = (v: unknown) => (v ? "yes" : "NO");
    if (!on || !names || !events || !labels || !book || running.current) {
      setTripStatus(
        `waiting: phone=${flag(phone)} on=${flag(on)} calendars=${flag(names)} ` +
          `events=${flag(events)} labels=${flag(labels)} legs=${flag(book)} ` +
          `running=${running.current ? "yes" : "no"}`,
      );
      return;
    }
    const save = (next: LegBook) => {
      writeLegBook(userId, next);
      queryClient.setQueryData(legBookQuery(userId).queryKey, next);
    };
    const candidates = travelCandidates(events, labels, names, Date.now());
    // Saved only when it changed: saving starts this effect again. Tidied against
    // the travel events on the phone, never the calendars the server lists (with
    // the connection removed it lists none); not before any label is read.
    const tidy =
      Object.keys(labels).length === 0 ? book : tidyLegBook(book, presentLegKeys(events, labels));
    if (tidy !== book) {
      save(tidy);
      return;
    }
    const batches = legBatches(candidates, book, askedThisLaunch);
    const travel = Object.values(labels).filter(
      (l) => l.kind === "flight" || l.kind === "travel",
    ).length;
    const read = Object.values(book);
    const journeys = read.filter((l) => l.mode !== "none" && l.confidence !== "low").length;
    if (batches.length === 0) {
      setTripStatus(
        `idle: labelled as travel=${travel} travel events counted=${candidates.length} ` +
          `read=${read.length} of which journeys=${journeys} asked this launch=${askedThisLaunch.size}; ` +
          `last run: ${lastTripRun}`,
      );
      return;
    }
    for (const batch of batches) for (const c of batch) askedThisLaunch.add(c.key);

    running.current = true;
    setTripStatus(`asking: ${batches.flat().length} travel events in ${batches.length} calls`);
    void (async () => {
      try {
        for (const batch of batches) {
          const { legs } = await readTripLegs(batch.map((c) => c.event));
          const added = Object.fromEntries(
            batch.flatMap((c, i) => (legs[i] ? [[c.key, legs[i]]] : [])),
          );
          save({ ...readLegBook(userId), ...added });
          lastTripRun = `ok, ${legs.filter(Boolean).length} of ${batch.length} read`;
          setTripStatus(lastTripRun);
        }
      } catch (err) {
        console.warn("reading trips failed", err);
        lastTripRun = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
        setTripStatus(lastTripRun);
      } finally {
        running.current = false;
      }
    })();
  }, [on, names, events, labels, book, queryClient, userId, phone]);
}

export interface Trips {
  /** Every trip found and what Casy asks about the rest. Empty where detection doesn't run. */
  detected: Detected;
  accept: (tripId: string) => void;
  /** Decline a suggestion, or delete an accepted trip: never suggested again. */
  decline: (id: string) => void;
  /** A way out with no way back: the day the person is back (a local midnight). */
  answerReturn: (id: string, day: number) => void;
  /** A way back with no way out: the day the person left (a local midnight). */
  answerOutbound: (id: string, day: number) => void;
  setHome: (city: string) => void;
  /**
   * Write an accepted trip into the phone's own calendar (Casy's primary when
   * it is on this phone, else iOS's default for new events); answers the
   * calendar's name. The trip remembers the event, so it isn't added twice.
   */
  addToCalendar: (mark: TripMark) => Promise<string>;
}

const NOTHING: Detected = { trips: [], questions: [] };

/**
 * The person's trips (#115): what the legs on this phone pair into, and the
 * questions where they don't, with the answers that settle them. Nothing
 * counts until accepted (trips.ts); answers are kept on the phone.
 */
export function useTrips(): Trips {
  const { userId, phone, on } = useTripsOn();
  const queryClient = useQueryClient();
  const names = useCountedPhoneCalendars(on, userId, phone);
  const { data: events } = useQuery({
    ...phoneEventDetailsQuery(userId, SEARCH_WINDOW),
    enabled: on,
  });
  const { data: labels } = useQuery({ ...labelBookQuery(userId), enabled: on });
  const { data: book } = useQuery({ ...legBookQuery(userId), enabled: on });
  const { data: answers } = useQuery({ ...tripAnswersQuery(userId), enabled: on });
  // Which loose ends are still worth asking about: fixed while the page is open.
  const [now] = useState(() => Date.now());
  const t = useT();
  const { lang } = useLang();
  const { data: primary } = useQuery({ ...primaryCalendarQuery(userId), enabled: on });
  const { data: busy } = useQuery({
    ...calendarBusyQuery(userId, SEARCH_WINDOW.start, SEARCH_WINDOW.end),
    enabled: on,
  });

  const detected = useMemo(
    () =>
      on && names && events && labels && book && answers
        ? detectTrips(
            phoneLegs(events, labels, book, names, answers),
            answers,
            now,
            casyTripSpans(events),
          )
        : NOTHING,
    [on, names, events, labels, book, answers, now],
  );

  const change = useCallback(
    (update: (a: TripAnswers) => TripAnswers) => {
      const next = update(readTripAnswers(userId));
      writeTripAnswers(userId, next);
      queryClient.setQueryData(tripAnswersQuery(userId).queryKey, next);
    },
    [queryClient, userId],
  );

  // Every accepted trip saved as itself, so it stays whatever happens to its
  // legs (#132: they were once all dropped with the connection removed).
  // Written only when something changed, as writing runs this again.
  useEffect(() => {
    if (!answers) return;
    const marks = tripMarks(detected, lang).filter(
      (m) => m.kind === "trip" && m.trip.accepted && m.trip.legs.length > 0,
    );
    const changed = marks.filter((m) => {
      const k = answers.kept[m.id];
      return !k || k.start !== m.start || k.end !== m.end || k.city !== m.city;
    });
    if (changed.length === 0) return;
    change((a) => {
      const kept = { ...a.kept };
      for (const m of changed) {
        kept[m.id] = { start: m.start, end: m.end, city: m.city, eventId: kept[m.id]?.eventId };
      }
      return { ...a, kept };
    });
  }, [detected, answers, lang, change]);

  // Casy's primary calendar, when it is one of this phone's: EventKit's id for it.
  const primaryOnPhone = useMemo(() => {
    const calendar = busy?.calendars.find((c) => c.id === primary?.calendarId);
    return calendar && calendar.connectionId === phone
      ? (calendar.externalId ?? undefined)
      : undefined;
  }, [busy, primary, phone]);

  return useMemo(
    () => ({
      detected,
      addToCalendar: async (mark: TripMark) => {
        const { eventId, calendar } = await addTripToPhone({
          title: t.trips.barAccepted(mark.city),
          notes: t.trips.calendarNote,
          start: mark.start,
          end: mark.end,
          calendarId: primaryOnPhone,
        });
        change((a) => ({
          ...a,
          kept: {
            ...a.kept,
            [mark.id]: { start: mark.start, end: mark.end, city: mark.city, eventId },
          },
        }));
        return calendar;
      },
      accept: (id) =>
        change((a) => ({
          ...a,
          accepted: [...a.accepted.filter((x) => x !== id), id],
          dismissed: a.dismissed.filter((x) => x !== id),
        })),
      decline: (id) =>
        change((a) => {
          const kept = { ...a.kept };
          delete kept[id];
          return {
            ...a,
            kept,
            accepted: a.accepted.filter((x) => x !== id),
            dismissed: [...a.dismissed.filter((x) => x !== id), id],
          };
        }),
      answerReturn: (id, day) => change((a) => ({ ...a, returns: { ...a.returns, [id]: day } })),
      answerOutbound: (id, day) =>
        change((a) => ({ ...a, outbounds: { ...a.outbounds, [id]: day } })),
      setHome: (city) => change((a) => ({ ...a, home: city })),
    }),
    [detected, change, t, primaryOnPhone],
  );
}

/** One pulse of a trip's bar: the length of `animate-trip-pulse` in index.css. */
const PULSE_MS = 1800;

/**
 * Which guess the bars of trips Casy is asking about show (tripBars), moving
 * on with each pulse while `active`. Still under reduced motion.
 */
export function useGuessStep(active: boolean): number {
  const still = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active || still) return;
    const timer = setInterval(() => setStep((n) => n + 1), PULSE_MS);
    return () => clearInterval(timer);
  }, [active, still]);
  return step;
}

/**
 * For testing (#115): forget every answer about trips on this phone (yes, no,
 * the days picked, home) and the flights read, so they are read again at once,
 * each trip is asked about again, and My calendar glides to it on the next
 * visit. Shown to testers and admins in Your data.
 */
export function useResetTrips(): () => void {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  return useCallback(() => {
    writeTripAnswers(userId, NO_ANSWERS);
    queryClient.setQueryData(tripAnswersQuery(userId).queryKey, NO_ANSWERS);
    // The flights are read again at once, as if never read.
    writeLegBook(userId, {});
    askedThisLaunch.clear();
    queryClient.setQueryData(legBookQuery(userId).queryKey, {});
    tripReveal.done = false;
  }, [queryClient, userId]);
}
