import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { answerDate, eventsQueryKey, type CandidateDate, type EventResponse } from "@/api/events";
import type { Exit } from "@/components/swipe/SwipeCard";
import { useSignedInUser } from "@/context/auth";
import { useDecidingRefresh } from "@/hooks/useDecidingRefresh";
import { useLabelledEvents } from "@/hooks/useEventLabels";
import { useLang } from "@/i18n/lang";
import { impactOn } from "@/lib/eventImpact";
import { importantClashes, type ImportantClash } from "@/lib/eventWarnings";
import { formatEventDate } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { askForPush } from "@/lib/pushAsk";
import { readStored, writeStored } from "@/lib/storage";
import { firstUnanswered, upcomingDates, type VoteEvent } from "@/lib/vote";
import { APP_TIME_ZONE } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/** Set once this device has answered a date: the swiping hint has done its job. */
const SWIPE_HINT_SEEN = "casy-swipe-hint-seen";

/**
 * Answering a vote's dates one at a time (#74), whatever draws them: the
 * swipe deck (DateDeck: a computer's open event) or the card over the home
 * page's month (#172, HomeVote). Each answer is saved as it is given, and the
 * next date doesn't wait for it: the answer shows at once, and a failed save
 * takes it back and says so (`error`). Back steps to a date before, to
 * change an answer. A yes that clashes with something critical of yours
 * (#114) is asked first (`confirmClash`), as is a no to the date already
 * decided, which moves it for everyone (`confirmMove`). The answer that
 * settles the event brings `celebrate`, and `onScheduled` hears of it.
 */
export function useVoteDeck(event: VoteEvent, { onScheduled }: { onScheduled?: () => void } = {}) {
  const { lang } = useLang();
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  // Your important events, to warn about on each date (#114; the app only).
  const mine = useLabelledEvents();
  const clashesFor = (d: CandidateDate) =>
    importantClashes(impactOn(event.impact, d, event.settings, TZ), mine, TZ);
  // One "now" for the whole visit, so a date beginning mid-swipe doesn't
  // reshuffle the stack under the thumb.
  const [now] = useState(() => Date.now());
  const dates = useMemo(() => upcomingDates(event, now), [event, now]);
  const you = event.invitees.find((i) => i.isYou)?.profileId ?? userId;

  // Answers given here, shown before (and regardless of) the server's reply.
  const [given, setGiven] = useState<Record<string, EventResponse>>({});
  // How to swipe is said until this device's first answer, then never again (#161).
  const [hintSeen] = useState(() => readStored(SWIPE_HINT_SEEN) === "1");
  const answerOf = (d: CandidateDate): EventResponse | undefined => given[d.id] ?? d.answers[you];
  const [index, setIndex] = useState(() => {
    const first = firstUnanswered(event, now);
    return first === -1 ? dates.length : first;
  });
  const [exit, setExit] = useState<Exit>("accepted");
  const [celebrate, setCelebrate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Once moved by a "no" to the decided date, the new date, said.
  const [moved, setMoved] = useState<string | null>(null);
  // Heard by the save below, which outlives the render that started it.
  const scheduled = useRef(onScheduled);
  useEffect(() => {
    scheduled.current = onScheduled;
  });

  // Answers are saved one after another, in the order given, while the
  // cards move on without waiting. Each reply is the whole list of events
  // as it stood; sent side by side, an earlier reply could arrive after a
  // later one and put back an older picture, such as a vote still waiting
  // after the last answer had already decided it.
  const saving = useRef<Promise<void>>(Promise.resolve());
  function save(dateId: string, response: EventResponse) {
    saving.current = saving.current.then(async () => {
      try {
        const data = await answerDate(event.id, dateId, response);
        queryClient.setQueryData(eventsQueryKey(userId), data.events);
        if (data.outcome === "scheduled") {
          setCelebrate(true);
          haptic("success");
          scheduled.current?.();
        }
        if (data.outcome === "moved") {
          const now = data.events.find((e) => e.id === event.id)?.currentDate;
          if (now) setMoved(formatEventDate(event.settings.kind, now, lang));
        }
      } catch (err) {
        setGiven((g) => {
          const rest = { ...g };
          delete rest[dateId];
          return rest;
        });
        setError(err instanceof Error ? err.message : String(err));
        void queryClient.invalidateQueries({ queryKey: eventsQueryKey(userId) });
      }
    });
  }
  // And should this page's copy still be behind, it catches up by itself.
  useDecidingRefresh(event);

  // Called off (or out of dates) while swiping: the cards left can't be
  // answered any more, so the outcome shows instead. A decided vote can
  // still be answered: a change of heart about its date moves it (below).
  const done =
    index >= dates.length || (event.status !== "pending" && event.status !== "scheduled");
  const current = done ? null : (dates[index] ?? null);
  // The last date answered just now (not an answered vote opened again): the
  // moment to offer notifications about the outcome (#139).
  const wasAnswering = useRef(!done);
  useEffect(() => {
    if (done && wasAnswering.current) askForPush("answered");
    wasAnswering.current = !done;
  }, [done]);
  const [confirmMove, setConfirmMove] = useState(false);
  // A yes to a date that gets in the way of something critical of yours
  // (#114) is asked once: the answer waiting for that, or null.
  const [confirmClash, setConfirmClash] = useState<EventResponse | null>(null);
  // The warning whose event is shown ("Vis mig").
  const [shownClash, setShownClash] = useState<ImportantClash | null>(null);

  function answer(response: EventResponse, confirmed = false) {
    if (!current) return;
    const risky =
      response !== "declined" && clashesFor(current).some((c) => c.severity === "critical");
    if (risky && !confirmed) {
      setConfirmClash(response);
      return;
    }
    writeStored(SWIPE_HINT_SEEN, "1");
    setConfirmClash(null);
    const movesDate =
      event.status === "scheduled" &&
      event.currentDate?.id === current.id &&
      response === "declined";
    if (movesDate && !confirmed) {
      setConfirmMove(true);
      return;
    }
    setConfirmMove(false);
    setShownClash(null);
    setError(null);
    setExit(response);
    setGiven((g) => ({ ...g, [current.id]: response }));
    setIndex((i) => i + 1);
    haptic("answer");
    save(current.id, response);
  }
  function back(to = index - 1) {
    if (to < 0) return;
    setConfirmMove(false);
    setConfirmClash(null);
    setShownClash(null);
    setExit("back");
    setIndex(to);
  }

  return {
    dates,
    index,
    current,
    done,
    exit,
    given,
    answerOf,
    hintSeen,
    clashesFor,
    answer,
    back,
    error,
    celebrate,
    moved,
    confirmMove,
    cancelMove: () => setConfirmMove(false),
    confirmClash,
    cancelClash: () => setConfirmClash(null),
    shownClash,
    setShownClash,
  };
}
