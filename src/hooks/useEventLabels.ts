import { useEffect, useRef } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { calendarBusyQuery } from "@/api/calendars";
import { labelEvents, relabelEvent, type EventLabel, type EventToLabel } from "@/api/eventLabels";
import { useAuth } from "@/context/auth";
import { useEventLabelsAllowed } from "@/hooks/useAiAllowed";
import { SEARCH_WINDOW } from "@/lib/eventSearch";
import {
  batchesToLabel,
  labelCandidates,
  labelKey,
  presentKeys,
  readLabelBook,
  updateBook,
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
 * Labels this phone's events with AI in the background (#112), mounted once
 * in App.tsx: each distinct title not labelled yet goes to calendar-label in
 * batches, soonest first, and the labels are kept on the phone. Nothing shows
 * unless someone opens an event (EventLabelDetails).
 *
 * Only in the iPhone app (titles are only on the phone), and only for
 * admins and people an admin switched labels on for while #120 is open
 * (useEventLabelsAllowed). Each title is asked
 * about at most once per app launch, so a failing call (the day's budget
 * used up, Anthropic down) isn't repeated in a loop; what is left is tried
 * on the next launch, or when the phone's calendars change.
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
  const asked = useRef(new Set<string>());
  const running = useRef(false);

  useEffect(() => {
    if (!on || !phone || !busy || !events || running.current) return;
    // This phone's calendars that count, by EventKit id, with their names.
    const names = new Map(
      busy.calendars
        .filter((c) => c.connectionId === phone && c.externalId && c.included)
        .map((c) => [c.externalId!, c.name]),
    );
    const save = (book: LabelBook) => {
      writeLabelBook(userId, book);
      queryClient.setQueryData(labelBookQuery(userId).queryKey, book);
    };
    // Labels for events no longer on the phone go first.
    let book = updateBook(readLabelBook(userId), [], presentKeys(events));
    save(book);
    const batches = batchesToLabel(labelCandidates(events, names, Date.now()), book, asked.current);
    if (batches.length === 0) return;
    for (const batch of batches) for (const c of batch) asked.current.add(c.key);

    running.current = true;
    void (async () => {
      try {
        for (const batch of batches) {
          const { labels } = await labelEvents(batch.map((c) => c.event));
          const added = batch.flatMap((c, i) => {
            const label = labels[i];
            return label ? [{ key: c.key, label: { ...label, count: c.event.count } }] : [];
          });
          book = updateBook(readLabelBook(userId), added);
          save(book);
        }
      } catch (err) {
        console.warn("labelling events failed", err);
      } finally {
        running.current = false;
      }
    })();
  }, [on, phone, busy, events, queryClient, userId]);
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
 */
export function useRelabel(calendarExternalId: string, event: EventToLabel) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ previous, note }: { previous: EventLabel; note: string }) =>
      relabelEvent(event, previous, note),
    onSuccess: (label) => {
      const key = labelKey(calendarExternalId, event.title);
      const book = updateBook(readLabelBook(userId), [
        { key, label: { ...label, count: event.count, corrected: true } },
      ]);
      writeLabelBook(userId, book);
      queryClient.setQueryData(labelBookQuery(userId).queryKey, book);
    },
  });
}
