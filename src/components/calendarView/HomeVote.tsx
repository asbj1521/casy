import { useEffect, useLayoutEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { RotateCcw } from "lucide-react";

import type { EventResponse } from "@/api/events";
import CardFace from "@/components/swipe/deck/CardFace";
import { ClashConfirm, MoveConfirm } from "@/components/swipe/deck/Confirms";
import { AnswerButtons, SwipeCard } from "@/components/swipe/SwipeCard";
import { useVoteDeck } from "@/components/swipe/useVoteDeck";
import Notice from "@/components/ui/Notice";
import { useMyCalendarDays } from "@/hooks/useMyCalendarDays";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import { clashKey } from "@/lib/eventWarnings";
import { formatEventDate, nameList } from "@/lib/format";
import { cn } from "@/lib/utils";
import { stillToAnswer, type VoteEvent } from "@/lib/vote";
import { APP_TIME_ZONE, startOfDay } from "@/lib/zone";

const TZ = APP_TIME_ZONE;
/** How long "Tak" stays before the month is the month again. */
const THANKS_MS = 1600;

/**
 * Answering a vote over the home page's month (#172): the card and the three
 * answers along the bottom, the month above it gliding to each date's day
 * (`onShowDay`), lit, with your answers stamped into the days as they are
 * given (`onView`). Swiped or tapped, as on the old swipe screen, and with
 * the same deck behind it (useVoteDeck). A tap on a day opens its hours,
 * the card stepping aside meanwhile (`hidden`). After the last answer a
 * short thanks, then it closes; a date it settled is then said over the
 * month and flies into its day (AgreedCard, useHomeVotes). Kept apart from the month on purpose: the day view to come (#176)
 * is meant to sit under this same card.
 */
export default function HomeVote({
  event,
  hidden,
  onShowDay,
  onView,
  onClose,
}: {
  event: VoteEvent;
  hidden: boolean;
  /** Bring a day into view above the card, which covers `clear` pixels. */
  onShowDay: (day: number, clear: number) => void;
  /** The day being answered, and the answers to stamp into their days. */
  onView: (view: { lit: number | null; stamps: ReadonlyMap<number, EventResponse> }) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const calendar = useMyCalendarDays();
  const panel = useRef<HTMLDivElement>(null);
  const deck = useVoteDeck(event);
  const { dates, index, current, done, answerOf } = deck;

  // Opened on a vote already answered (a push, or Aftaler's row): from its
  // first date, to look again or change an answer.
  const startedDone = useRef(done && dates.length > 0);
  useEffect(() => {
    if (startedDone.current) deck.back(0);
    // Only on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each date in view above the card, as it comes up.
  const day = current ? startOfDay(Date.parse(current.start), TZ) : null;
  useLayoutEffect(() => {
    if (day !== null) onShowDay(day, panel.current?.offsetHeight ?? 0);
  }, [day, onShowDay]);
  // The answers given, stamped into their days.
  const answers = dates.map((d) => answerOf(d) ?? "").join();
  useEffect(() => {
    const stamps = new Map<number, EventResponse>();
    for (const d of dates) {
      const a = answerOf(d);
      if (a) stamps.set(startOfDay(Date.parse(d.start), TZ), a);
    }
    onView({ lit: day, stamps });
    // `answers` stands for what answerOf reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, day, onView]);

  // All answered: a moment of thanks, then the plain month.
  useEffect(() => {
    if (!done || startedDone.current) return;
    const id = window.setTimeout(onClose, THANKS_MS);
    return () => window.clearTimeout(id);
  }, [done, onClose]);

  const waitingFor = stillToAnswer(event);

  return (
    <div
      ref={panel}
      role="region"
      aria-label={eventTitle(event.title, t)}
      inert={hidden}
      className={cn(
        "glass fixed inset-x-0 bottom-0 z-30 rounded-t-[28px] px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-3 transition-transform duration-300",
        hidden && "translate-y-full",
      )}
    >
      <header className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold text-foreground">
            {eventTitle(event.title, t)}
          </p>
          <p className="truncate text-[13px] text-muted-foreground">{event.group.name}</p>
        </div>
        <button
          type="button"
          onClick={() => deck.back()}
          disabled={index === 0 || done}
          aria-label={t.swipe.previous}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-amber-600 transition disabled:opacity-30"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg px-2 py-1 text-[15px] font-semibold text-primary"
        >
          {t.swipe.done}
        </button>
      </header>

      {/* One segment per date: answered, the one on screen, still to come. */}
      <div className="mt-2 flex gap-1">
        {dates.map((d, i) => (
          <button
            key={d.id}
            type="button"
            onClick={() => deck.back(i)}
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

      {done || !current ? (
        <div className="flex h-[min(30dvh,224px)] flex-col items-center justify-center px-6 text-center">
          <p className="text-[20px] font-bold text-foreground">{t.swipe.doneTitle}</p>
          {waitingFor.length > 0 && (
            <p className="mt-1 text-[15px] text-muted-foreground">
              {t.swipe.waitingFor(nameList(waitingFor, lang))}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="relative mt-3 h-[min(30dvh,224px)]">
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
                  clashes={deck.clashesFor(dates[index + 1])}
                  compact
                />
              </div>
            )}
            <AnimatePresence custom={deck.exit} initial={false}>
              <SwipeCard key={current.id} exitTo={deck.exit} onAnswer={deck.answer} draggable>
                <CardFace
                  event={event}
                  date={current}
                  position={index + 1}
                  total={dates.length}
                  yours={answerOf(current)}
                  calendar={calendar}
                  clashes={deck.clashesFor(current)}
                  shownClash={deck.shownClash ? clashKey(deck.shownClash) : null}
                  onShowClash={deck.setShownClash}
                  compact
                />
              </SwipeCard>
            </AnimatePresence>
          </div>
          {deck.confirmMove ? (
            <MoveConfirm
              onConfirm={() => deck.answer("declined", true)}
              onCancel={deck.cancelMove}
              className="my-3"
            />
          ) : deck.confirmClash ? (
            <ClashConfirm
              onConfirm={() => deck.confirmClash && deck.answer(deck.confirmClash, true)}
              onCancel={deck.cancelClash}
              className="my-3"
            />
          ) : (
            <AnswerButtons onAnswer={deck.answer} screen />
          )}
          {!deck.hintSeen && index === 0 && Object.keys(deck.given).length === 0 && (
            <p className="px-2 pb-1 text-center text-xs text-muted-foreground">{t.swipe.hint}</p>
          )}
        </>
      )}

      {deck.error && (
        <Notice tone="error" bare className="mt-1">
          {deck.error}
        </Notice>
      )}
      {/* Words for screen readers as the cards move. */}
      <p className="sr-only" aria-live="polite">
        {current
          ? `${t.swipe.dateOf(index + 1, dates.length)}: ${formatEventDate(event.settings.kind, current, lang)}`
          : t.swipe.doneTitle}
      </p>
    </div>
  );
}
