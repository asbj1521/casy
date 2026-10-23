import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";

import { calendarBusyQuery } from "@/api/calendars";
import { readTripLegs } from "@/api/tripLegs";
import { useAuth } from "@/context/auth";
import { useAiContent } from "@/hooks/useAiAllowed";
import { labelBookQuery } from "@/hooks/useEventLabels";
import { SEARCH_WINDOW } from "@/lib/eventSearch";
import { isNativeApp } from "@/lib/nativeApp";
import { phoneConnectionId, phoneEventDetailsQuery } from "@/lib/phoneCalendar";
import {
  legBatches,
  phoneLegs,
  readLegBook,
  readTripAnswers,
  tidyLegBook,
  travelCandidates,
  writeLegBook,
  writeTripAnswers,
  type LegBook,
} from "@/lib/tripLegBook";
import { detectTrips, type Detected, type TripAnswers } from "@/lib/trips";

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

/** Events asked about since the app was opened: each at most once, so a failing call isn't repeated in a loop. */
const askedThisLaunch = new Set<string>();

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
    if (!on || !names || !events || !labels || !book || running.current) return;
    const save = (next: LegBook) => {
      writeLegBook(userId, next);
      queryClient.setQueryData(legBookQuery(userId).queryKey, next);
    };
    const candidates = travelCandidates(events, labels, names, Date.now());
    // Saved only when it changed: saving starts this effect again.
    const tidy = tidyLegBook(book, candidates);
    if (tidy !== book) {
      save(tidy);
      return;
    }
    const batches = legBatches(candidates, book, askedThisLaunch);
    if (batches.length === 0) return;
    for (const batch of batches) for (const c of batch) askedThisLaunch.add(c.key);

    running.current = true;
    void (async () => {
      try {
        for (const batch of batches) {
          const { legs } = await readTripLegs(batch.map((c) => c.event));
          const added = Object.fromEntries(
            batch.flatMap((c, i) => (legs[i] ? [[c.key, legs[i]]] : [])),
          );
          save({ ...readLegBook(userId), ...added });
        }
      } catch (err) {
        console.warn("reading trips failed", err);
      } finally {
        running.current = false;
      }
    })();
  }, [on, names, events, labels, book, queryClient, userId]);
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

  const detected = useMemo(
    () =>
      on && names && events && labels && book && answers
        ? detectTrips(phoneLegs(events, labels, book, names, answers), answers, now)
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

  return useMemo(
    () => ({
      detected,
      accept: (id) =>
        change((a) => ({
          ...a,
          accepted: [...a.accepted.filter((x) => x !== id), id],
          dismissed: a.dismissed.filter((x) => x !== id),
        })),
      decline: (id) =>
        change((a) => ({
          ...a,
          accepted: a.accepted.filter((x) => x !== id),
          dismissed: [...a.dismissed.filter((x) => x !== id), id],
        })),
      answerReturn: (id, day) => change((a) => ({ ...a, returns: { ...a.returns, [id]: day } })),
      answerOutbound: (id, day) =>
        change((a) => ({ ...a, outbounds: { ...a.outbounds, [id]: day } })),
      setHome: (city) => change((a) => ({ ...a, home: city })),
    }),
    [detected, change],
  );
}
