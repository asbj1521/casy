import { useEffect, useMemo, useRef } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { calendarBusyQuery } from "@/api/calendars";
import { sendLabelCorrection } from "@/api/aiFeedback";
import { labelEvents, relabelEvent, type EventLabel, type EventToLabel } from "@/api/eventLabels";
import { useAuth } from "@/context/auth";
import { useAiContent, useAiShare } from "@/hooks/useAiAllowed";
import { SEARCH_WINDOW } from "@/lib/eventSearch";
import {
  addCorrection,
  batchesToLabel,
  correctionsToSend,
  labelCandidates,
  labelKey,
  LOOK_BACK_MS,
  markCalendarStale,
  presentKeys,
  readCorrections,
  readLabelBook,
  tidyBook,
  updateBook,
  writeCorrections,
  writeLabelBook,
  type LabelBook,
  type StoredLabel,
} from "@/lib/eventLabels";
import { labelledEvents, type LabelledEvent } from "@/lib/eventWarnings";
import { setLabelStatus } from "@/lib/labelStatus";
import { busySpan } from "@/lib/phoneBusy";
import { isNativeApp } from "@/lib/nativeApp";
import { phoneConnectionId, phoneEventDetailsQuery } from "@/lib/phoneCalendar";

/** The labels kept on this phone, read once and then kept up to date in the cache. */
export function labelBookQuery(userId: string) {
  return queryOptions({
    queryKey: ["event-labels", userId],
    queryFn: () => readLabelBook(userId),
    staleTime: Infinity,
  });
}

/**
 * Titles asked about since the app was opened: each at most once, so a
 * failing call isn't repeated in a loop. A correction takes its calendar's
 * titles out again, so they are labelled anew with it (useRelabel).
 */
const askedThisLaunch = new Set<string>();

/** How the last labelling call went, kept for the status line after it goes idle. */
let lastRun = "none yet";

/** Start asking afresh, after the labels were deleted (the AI's consent withdrawn, #120). */
export function forgetAskedTitles(): void {
  askedThisLaunch.clear();
}

/**
 * Labels this phone's events with AI in the background (#112), mounted once
 * in App.tsx: each distinct title not labelled yet (or marked stale by a
 * correction in its calendar) goes to calendar-label in batches, soonest
 * first, with the person's corrections in hand, and the labels are kept on
 * the phone. Nothing shows unless someone opens an event (EventLabelDetails).
 *
 * Only in the iPhone app (titles are only on the phone), and only for those
 * who said yes to the AI using their calendar (#120), and admins and AI
 * testers while it is tested (useAiContent). What a failing call left is
 * tried on the next launch, or when the phone's calendars change.
 */
export function useAutoLabel() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const phone = isNativeApp && userId ? phoneConnectionId(userId) : null;
  const labelsAllowed = useAiContent();
  const on = !!phone && labelsAllowed;
  const { data: busy } = useQuery({
    ...calendarBusyQuery(userId, SEARCH_WINDOW.start, SEARCH_WINDOW.end),
    enabled: on,
  });
  const { data: events } = useQuery({
    ...phoneEventDetailsQuery(userId, SEARCH_WINDOW),
    enabled: on,
  });
  // Watched so a correction (which marks labels stale) starts a run at once.
  const { data: book } = useQuery({ ...labelBookQuery(userId), enabled: on });
  const running = useRef(false);

  useEffect(() => {
    // One line for testers in Your data: which condition holds, which doesn't.
    const flag = (v: unknown) => (v ? "yes" : "NO");
    if (!on || !phone || !busy || !events || !book || running.current) {
      setLabelStatus(
        `waiting: app=${flag(isNativeApp)} allowed=${flag(labelsAllowed)} phone=${flag(phone)} ` +
          `calendars=${flag(busy)} events=${events ? events.length : "NO"} book=${flag(book)} ` +
          `running=${running.current ? "yes" : "no"}`,
      );
      return;
    }
    // This phone's calendars that count, by EventKit id, with their names.
    const names = new Map(
      busy.calendars
        .filter((c) => c.connectionId === phone && c.externalId && c.included)
        .map((c) => [c.externalId!, c.name]),
    );
    const save = (next: LabelBook) => {
      writeLabelBook(userId, next);
      queryClient.setQueryData(labelBookQuery(userId).queryKey, next);
    };
    const candidates = labelCandidates(events, names, Date.now());
    setLabelStatus(
      `ready: phone calendars=${names.size} events=${events.length} titles=${candidates.length} ` +
        `labelled=${Object.keys(book).length}`,
    );
    // Saved only when it changed: saving starts this effect again.
    const tidy = tidyBook(book, presentKeys(events), candidates);
    if (tidy !== book) {
      save(tidy);
      return;
    }
    const batches = batchesToLabel(candidates, book, askedThisLaunch);
    if (batches.length === 0) {
      // Where the phone's events drop out on the way to a title worth labelling.
      const inCalendars = events.filter((e) => names.has(e.calendarId));
      const titled = inCalendars.filter((e) => e.title?.trim());
      const counted = titled.filter((e) => busySpan(e));
      const recent = counted.filter((e) => busySpan(e)!.end >= Date.now() - LOOK_BACK_MS);
      // Whether the phone's calendars the server lists are the ones its events are in.
      const mine = busy.calendars.filter((c) => c.connectionId === phone);
      const serverIds = new Set(mine.map((c) => c.externalId));
      const eventCalendars = new Set(events.map((e) => e.calendarId));
      const known = [...eventCalendars].filter((id) => serverIds.has(id)).length;
      setLabelStatus(
        `idle: server lists ${mine.length} phone calendars (${mine.filter((c) => c.included).length} counted), ` +
          `events are in ${eventCalendars.size} calendars of which the server knows ${known}; ` +
          `events=${events.length} in counted calendars=${inCalendars.length} ` +
          `with a title=${titled.length} counting as busy=${counted.length} ` +
          `not over a week ago=${recent.length} titles=${candidates.length} ` +
          `labelled=${Object.keys(book).length} asked this launch=${askedThisLaunch.size}; ` +
          `last run: ${lastRun}`,
      );
      return;
    }
    for (const batch of batches) for (const c of batch) askedThisLaunch.add(c.key);

    running.current = true;
    setLabelStatus(`asking: ${batches.flat().length} titles in ${batches.length} calls`);
    void (async () => {
      try {
        for (const batch of batches) {
          // Read afresh each time: a correction may have come in meanwhile.
          const corrections = correctionsToSend(readCorrections(userId));
          const { labels } = await labelEvents(
            batch.map((c) => c.event),
            corrections,
          );
          const added = batch.flatMap((c, i) => {
            const label = labels[i];
            return label
              ? [
                  {
                    key: c.key,
                    label: { ...label, count: c.event.count, calendarId: c.calendarId },
                  },
                ]
              : [];
          });
          save(updateBook(readLabelBook(userId), added));
          lastRun = `ok, ${labels.filter(Boolean).length} of ${batch.length} labelled`;
          setLabelStatus(`answered: ${labels.filter(Boolean).length} of ${batch.length} labelled`);
        }
      } catch (err) {
        console.warn("labelling events failed", err);
        lastRun = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
        setLabelStatus(lastRun);
      } finally {
        running.current = false;
        // Whatever came in while this ran (a correction) gets its own run.
        void queryClient.invalidateQueries({ queryKey: labelBookQuery(userId).queryKey });
      }
    })();
  }, [on, phone, busy, events, book, queryClient, userId, labelsAllowed]);
}

/**
 * The label kept for an event of this phone, or undefined: none yet, not
 * the app, or not one of this phone's calendars (`calendarExternalId` null).
 */
export function useEventLabel(
  calendarExternalId: string | null | undefined,
  title: string | undefined,
): StoredLabel | undefined {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const key = calendarExternalId && title ? labelKey(calendarExternalId, title) : null;
  const { data } = useQuery({
    ...labelBookQuery(userId),
    enabled: isNativeApp && !!userId && !!key,
    select: (book: LabelBook) => (key ? book[key] : undefined),
  });
  return data;
}

/**
 * "Forkert?": label one event again from what its owner wrote, and keep the
 * result as theirs (corrected), so background labelling never replaces it.
 * The correction is remembered on the phone and sent with every later call,
 * and the other labels in the same calendar are marked stale, so the
 * background labels them again with it in hand.
 */
export function useRelabel(calendarExternalId: string, event: EventToLabel) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const shares = useAiShare();
  return useMutation({
    mutationFn: ({ previous, note }: { previous: EventLabel; note: string }) =>
      relabelEvent(event, previous, note, correctionsToSend(readCorrections(userId))),
    onSuccess: (label, { note, previous }) => {
      // With the person's yes, the correction also goes to Casy for review
      // (#122), in the background: it is never worth failing the correction over.
      if (shares) {
        void sendLabelCorrection({
          title: event.title,
          calendar: event.calendar,
          previous,
          note,
          label,
        }).catch((err) => console.warn("sending the correction failed", err));
      }
      const key = labelKey(calendarExternalId, event.title);
      writeCorrections(
        userId,
        addCorrection(readCorrections(userId), {
          key,
          calendarId: calendarExternalId,
          title: event.title,
          calendar: event.calendar,
          note,
          label,
          at: Date.now(),
        }),
      );
      const corrected = updateBook(readLabelBook(userId), [
        {
          key,
          label: { ...label, count: event.count, corrected: true, calendarId: calendarExternalId },
        },
      ]);
      const { book, keys } = markCalendarStale(corrected, calendarExternalId);
      for (const k of keys) askedThisLaunch.delete(k);
      writeLabelBook(userId, book);
      queryClient.setQueryData(labelBookQuery(userId).queryKey, book);
    },
  });
}

const NONE: LabelledEvent[] = [];

/**
 * Your own events with their labels, for the common-sense warnings (#114):
 * this phone's events, read on the phone, paired with the labels kept on it.
 * Empty on the website, without a phone connection, and for anyone who
 * hasn't said yes to the AI using their calendar (#120) and isn't an admin
 * or AI tester; never sent anywhere.
 */
export function useLabelledEvents(): LabelledEvent[] {
  return useLabelledEventsState().events;
}

/**
 * useLabelledEvents, and whether the events and labels have been read yet:
 * an empty list is a real one only once they have (#119 sends it as such).
 */
export function useLabelledEventsState(): { ready: boolean; events: LabelledEvent[] } {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const allowed = useAiContent();
  const on = isNativeApp && !!userId && allowed && !!phoneConnectionId(userId);
  const { data: events } = useQuery({
    ...phoneEventDetailsQuery(userId, SEARCH_WINDOW),
    enabled: on,
  });
  const { data: book } = useQuery({ ...labelBookQuery(userId), enabled: on });
  return useMemo(
    () =>
      on && events && book
        ? { ready: true, events: labelledEvents(events, book) }
        : { ready: false, events: NONE },
    [on, events, book],
  );
}
