import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, RotateCcw } from "lucide-react";

import CalendarSheet from "@/components/swipe/CalendarSheet";
import CalendarStrip from "@/components/swipe/CalendarStrip";
import Celebration from "@/components/swipe/Celebration";
import Notice from "@/components/ui/Notice";
import { useMyCalendarDays } from "@/hooks/useMyCalendarDays";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import { formatEventDate } from "@/lib/format";
import { clashKey } from "@/lib/eventWarnings";
import { cn } from "@/lib/utils";
import type { VoteEvent } from "@/lib/vote";
import { APP_TIME_ZONE, startOfDay } from "@/lib/zone";
import { AnswerButtons, SwipeCard } from "@/components/swipe/SwipeCard";
import { useVoteDeck } from "@/components/swipe/useVoteDeck";
import CardFace from "./deck/CardFace";
import DoneView from "./deck/DoneView";
import { ClashConfirm, MoveConfirm } from "./deck/Confirms";

const TZ = APP_TIME_ZONE;

/**
 * A vote's dates as a stack of cards to swipe (#74), one at a time: right
 * for "I can", left for "I can't", up for "I can, but would rather not", or
 * the three buttons under it (and the arrow keys). Your own calendar around
 * each date sits under the card (CalendarStrip), drawn like Apple Calendar,
 * and a tap grows it into the same days on the whole screen (CalendarSheet).
 * Back steps to the date before, to change an answer.
 *
 * Each answer is saved as it is given, and the next card doesn't wait for
 * it: the answer shows at once, and a failed save takes it back and says so.
 * The answer that settles the event brings the celebration.
 *
 * `screen` fills a phone's screen (SwipeDates); `pane` sits in a computer's
 * open event (VoteDetails).
 */
export default function DateDeck({
  event,
  variant,
}: {
  event: VoteEvent;
  variant: "screen" | "pane";
}) {
  const t = useT();
  const { lang } = useLang();
  const calendar = useMyCalendarDays();
  const {
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
    cancelMove,
    confirmClash,
    cancelClash,
    shownClash,
    setShownClash,
  } = useVoteDeck(event);
  // The whole calendar, open, zoomed out of the strip's place on screen.
  const [calendarFrom, setCalendarFrom] = useState<DOMRect | null>(null);
  const calendarOpen = calendarFrom !== null;

  // The arrow keys, for a computer: right can, left can't, up rather not,
  // backspace back. Not while typing somewhere, nor with the calendar open.
  const keys = useRef({ answer, back, open: false });
  useEffect(() => {
    keys.current = { answer, back, open: calendarOpen };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (keys.current.open || target?.closest("input, textarea, select, [contenteditable]")) {
        return;
      }
      const move: Record<string, () => void> = {
        ArrowRight: () => keys.current.answer("accepted"),
        ArrowLeft: () => keys.current.answer("declined"),
        ArrowUp: () => keys.current.answer("maybe"),
        Backspace: () => keys.current.back(),
      };
      if (move[e.key]) {
        e.preventDefault();
        move[e.key]();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const marked = useMemo(
    () => new Set(dates.map((d) => startOfDay(Date.parse(d.start), TZ))),
    [dates],
  );
  const slotLabel = eventTitle(event.title, t);
  const screen = variant === "screen";

  // One segment per date: answered, the one on screen, still to come.
  const progress = (
    <div className={cn("flex gap-1", screen ? "px-4" : "min-w-0 flex-1")}>
      {dates.map((d, i) => (
        <button
          key={d.id}
          type="button"
          onClick={() => back(i)}
          aria-label={t.swipe.dateOf(i + 1, dates.length)}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            i === index
              ? "bg-foreground"
              : answerOf(d) === "accepted"
                ? "bg-emerald-500"
                : answerOf(d) === "maybe"
                  ? "bg-amber-400"
                  : answerOf(d) === "declined"
                    ? "bg-rose-400"
                    : "bg-secondary",
          )}
        />
      ))}
    </div>
  );

  return (
    // Both fill the height they're given: a phone's screen, or on a computer
    // the window's height below the event's header (VoteDetails).
    <div className="flex h-full min-h-0 flex-col">
      {/* Back to My events (a phone), the event, how far along, and a step back. */}
      <header className={cn("flex items-center gap-2", screen ? "h-12 shrink-0 px-2" : "mb-2")}>
        {screen && (
          <Link
            to="/events"
            aria-label={t.swipe.toEvents}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
        )}
        {/* A computer's pane already names the event above the cards, so
            how far along it is takes the title's place there. */}
        {screen ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-foreground">
              {eventTitle(event.title, t)}
            </p>
            <p className="truncate text-xs text-muted-foreground">{event.group.name}</p>
          </div>
        ) : (
          progress
        )}
        <button
          type="button"
          onClick={() => back()}
          disabled={index === 0}
          aria-label={t.swipe.previous}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-card text-amber-600 shadow-sm transition disabled:opacity-30"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
      </header>
      {screen && progress}

      {done ? (
        <DoneView
          event={event}
          dates={dates}
          answerOf={answerOf}
          onChange={back}
          moved={moved}
          screen={screen}
        />
      ) : (
        current &&
        (() => {
          // The card, the next date waiting under it, your calendar, and the answers.
          const stack = (
            <div className={cn("relative h-full", screen && "mx-auto max-w-md")}>
              {/* The next date waits underneath, so the stack reads as a stack. */}
              {dates[index + 1] && (
                <div aria-hidden className="absolute inset-0 translate-y-2 scale-[0.96] opacity-60">
                  <CardFace
                    event={event}
                    date={dates[index + 1]}
                    position={index + 2}
                    total={dates.length}
                    yours={answerOf(dates[index + 1])}
                    calendar={calendar}
                    clashes={clashesFor(dates[index + 1])}
                  />
                </div>
              )}
              <AnimatePresence custom={exit} initial={false}>
                <SwipeCard key={current.id} exitTo={exit} onAnswer={answer} draggable={screen}>
                  <CardFace
                    event={event}
                    date={current}
                    position={index + 1}
                    total={dates.length}
                    yours={answerOf(current)}
                    calendar={calendar}
                    clashes={clashesFor(current)}
                    shownClash={shownClash ? clashKey(shownClash) : null}
                    onShowClash={setShownClash}
                  />
                </SwipeCard>
              </AnimatePresence>
            </div>
          );
          const strip = (
            <CalendarStrip
              key={current.id}
              date={current}
              slotLabel={slotLabel}
              calendar={calendar}
              onOpen={setCalendarFrom}
              fit={!screen}
              focus={shownClash && { start: shownClash.event.start, end: shownClash.event.end }}
            />
          );
          const hint = !hintSeen && index === 0 && !Object.keys(given).length && (
            <p
              className={cn(
                "text-center text-xs text-muted-foreground",
                screen ? "px-6 pb-2" : "mt-1",
              )}
            >
              {screen ? t.swipe.hint : t.swipe.keysHint}
            </p>
          );
          // A phone: one column, the card taking what height is left. A
          // computer: the card and its answers beside your calendar, all in
          // one screen's height; no swiping, buttons and keys instead.
          return screen ? (
            <>
              <div className="relative mt-3 min-h-[230px] flex-1 px-4">{stack}</div>
              <div className="mt-3 px-4">
                <div className="mx-auto max-w-md">{strip}</div>
              </div>
              {confirmMove ? (
                <MoveConfirm
                  onConfirm={() => answer("declined", true)}
                  onCancel={cancelMove}
                  className="mx-4 my-3"
                />
              ) : confirmClash ? (
                <ClashConfirm
                  onConfirm={() => answer(confirmClash, true)}
                  onCancel={cancelClash}
                  className="mx-4 my-3"
                />
              ) : (
                <AnswerButtons onAnswer={answer} screen />
              )}
              {hint}
            </>
          ) : (
            <div className="mt-3 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-5">
              <div className="flex min-h-0 flex-col">
                <div className="relative min-h-[200px] flex-1">{stack}</div>
                {confirmMove ? (
                  <MoveConfirm
                    onConfirm={() => answer("declined", true)}
                    onCancel={cancelMove}
                    className="mt-3"
                  />
                ) : confirmClash ? (
                  <ClashConfirm
                    onConfirm={() => answer(confirmClash, true)}
                    onCancel={cancelClash}
                    className="mt-3"
                  />
                ) : (
                  <AnswerButtons onAnswer={answer} screen={false} />
                )}
                {hint}
              </div>
              {strip}
            </div>
          );
        })()
      )}

      {error && (
        <Notice tone="error" bare className={cn("mt-2", screen && "px-4")}>
          {error}
        </Notice>
      )}

      {/* Zoomed out of the strip, and back into it. */}
      {calendarOpen && current && (
        <CalendarSheet
          date={current}
          slotLabel={slotLabel}
          marked={marked}
          calendar={calendar}
          from={calendarFrom}
          contained={!screen}
          onClose={() => setCalendarFrom(null)}
        />
      )}
      {celebrate && <Celebration />}
      {/* Words for screen readers as the cards move. */}
      <p className="sr-only" aria-live="polite">
        {current
          ? `${t.swipe.dateOf(index + 1, dates.length)}: ${formatEventDate(event.settings.kind, current, lang)}`
          : t.swipe.doneTitle}
      </p>
    </div>
  );
}

/**
 * Asked before "I can't" on a vote's decided date, which moves it for
 * everyone: Casy then decides again from everyone's answers.
 */
