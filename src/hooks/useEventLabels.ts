import { useEffect, useRef } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { calendarBusyQuery } from "@/api/calendars";
import { labelEvents, relabelEvent, type EventLabel, type EventToLabel } from "@/api/eventLabels";
import { useAuth } from "@/context/auth";
import { useEventLabelsAllowed } from "@/hooks/useAiAllowed";
import { SEARCH_WINDOW } from "@/lib/eventSearch";
import {
  addCorrection,
  batchesToLabel,
  correctionsToSend,
  labelCandidates,
  labelKey,
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
import { isNativeApp } from "@/lib/nativeApp";
import { phoneConnectionId, phoneEventDetailsQuery } from "@/lib/phoneCalendar";

/** The labels kept on this phone, read once and then kept up to date in the cache. */
function labelBookQuery(userId: string) {
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

/**
 * Labels this phone's events with AI in the background (#112), mounted once
 * in App.tsx: each distinct title not labelled yet (or marked stale by a
 * correction in its calendar) goes to calendar-label in batches, soonest
 * first, with the person's corrections in hand, and the labels are kept on
 * the phone. Nothing shows unless someone opens an event (EventLabelDetails).
 *
 * Only in the iPhone app (titles are only on the phone), and only for
 * admins and people an admin switched labels on for while #120 is open
 * (useEventLabelsAllowed). What a failing call left is tried on the next
 * launch, or when the phone's calendars change.
 */
export function useAutoLabel() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const phone = isNativeApp && userId ? phoneConnectionId(userId) : null;
  const labelsAllowed = useEventLabelsAllowed();
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
    if (!on || !phone || !busy || !events || !book || running.current) return;
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
    // Saved only when it changed: saving starts this effect again.
    const tidy = tidyBook(book, presentKeys(events), candidates);
    if (tidy !== book) {
      save(tidy);
      return;
    }
    const batches = batchesToLabel(candidates, book, askedThisLaunch);
    if (batches.length === 0) return;
    for (const batch of batches) for (const c of batch) askedThisLaunch.add(c.key);

    running.current = true;
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
        }
      } catch (err) {
        console.warn("labelling events failed", err);
      } finally {
        running.current = false;
        // Whatever came in while this ran (a correction) gets its own run.
        void queryClient.invalidateQueries({ queryKey: labelBookQuery(userId).queryKey });
      }
    })();
  }, [on, phone, busy, events, book, queryClient, userId]);
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
  return useMutation({
    mutationFn: ({ previous, note }: { previous: EventLabel; note: string }) =>
      relabelEvent(event, previous, note, correctionsToSend(readCorrections(userId))),
    onSuccess: (label, { note }) => {
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
