import { useEffect, useLayoutEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { RotateCcw } from "lucide-react";

import type { EventResponse } from "@/api/events";
import CardFace from "@/components/swipe/deck/CardFace";
import { ClashConfirm, MoveConfirm } from "@/components/swipe/deck/Confirms";
import { AnswerButtons, SwipeCard } from "@/components/swipe/SwipeCard";
import { useVoteDeck } from "@/components/swipe/useVoteDeck";
import Collapse from "@/components/ui/Collapse";
import Notice from "@/components/ui/Notice";
import { useMyCalendarDays } from "@/hooks/useMyCalendarDays";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import { clashKey } from "@/lib/eventWarnings";
import { formatEventDate, nameList } from "@/lib/format";
import { cn } from "@/lib/utils";
import { stillToAnswer, type VoteEvent } from "@/lib/vote";
/** How long "Tak" stays before the card goes. */
const THANKS_MS = 1600;

/** How far a finger may move on the folded card and still be a tap that unfolds it. */
const TAP_PX = 8;

/** What the day view under the card shows of the vote (#176). */
export interface VoteView {
  /** The date being answered; null once all are. */
  current: { start: number; end: number } | null;
  /** Your answers so far, by date id, stamped on the dates. */
  answers: ReadonlyMap<string, EventResponse>;
}

/**
 * Answering a vote on the home page (#172), over the day view (#176): the
 * card and the three answers along the bottom, the day view above it
 * gliding to each date's own hours as it comes up, with your answers
 * stamped on the dates (`onView`). Swiped or tapped, as on the old swipe
 * screen, and with the same deck behind it (useVoteDeck). After the last
 * answer a short thanks, then the card goes and the day view stays on that
 * day; a date it settled is said over the month once you are back there,
 * and flies into its day (AgreedCard, useHomeVotes).
 *
 * A touch on the calendar folds it down to the card alone (`folded`), so
 * the day view is nearly all in sight while you check it: the glass, the
 * title row, the dates' bar and the answer buttons go, and the card stays
 * along the bottom to be swiped, the next date's card folded too. A tap on
 * the card unfolds it (`onUnfold`), and so does an answer needing a
 * confirm, or the last answer. How much of the screen it covers goes to
 * `onClear` as it changes.
 */
export default function HomeVote({
  event,
  folded: foldAsked,
  onView,
  onClear,
  onUnfold,
  onClose,
}: {
  event: VoteEvent;
  folded: boolean;
  onView: (view: VoteView) => void;
  onClear: (px: number) => void;
  onUnfold: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const calendar = useMyCalendarDays();
  const panel = useRef<HTMLDivElement>(null);
  const deck = useVoteDeck(event);
  const { dates, index, current, done, answerOf } = deck;
  const folded = foldAsked && !done && !deck.confirmMove && !deck.confirmClash;

  // How much of the screen it covers, for the day view to keep clear.
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el) return;
    const report = () => onClear(el.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onClear]);

  // A tap on the folded card, not a swipe, unfolds it.
  const press = useRef<{ x: number; y: number } | null>(null);

  // Opened on a vote already answered (a push, or Aftaler's row): from its
  // first date, to look again or change an answer.
  const startedDone = useRef(done && dates.length > 0);
  useEffect(() => {
    if (startedDone.current) deck.back(0);
    // Only on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each date in view above the card as it comes up, and the answers given,
  // before the screen is drawn, so the day view never shows the one before.
  const currentId = current?.id ?? null;
  const given = dates.map((d) => answerOf(d) ?? "").join();
  useLayoutEffect(() => {
    const answers = new Map<string, EventResponse>();
    for (const d of dates) {
      const a = answerOf(d);
      if (a) answers.set(d.id, a);
    }
    onView({
      current: current ? { start: Date.parse(current.start), end: Date.parse(current.end) } : null,
      answers,
    });
    // `currentId` and `given` stand for what current and answerOf read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, given, onView]);

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
      className="fixed inset-x-0 bottom-0 z-[45] px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-3"
    >
      {/* The glass behind it all, gone while it is folded down to the card. */}
      <div
        aria-hidden
        className={cn(
          "glass absolute inset-0 rounded-t-[28px] transition-[opacity,transform] duration-300",
          folded && "translate-y-1/4 opacity-0",
        )}
      />
      <div className="relative">
        <Collapse open={!folded}>
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
        </Collapse>

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
            <div
              className={cn("relative h-[min(30dvh,224px)]", !folded && "mt-3")}
              onPointerDown={(e) => {
                press.current = { x: e.clientX, y: e.clientY };
              }}
              onClickCapture={(e) => {
                const p = press.current;
                press.current = null;
                if (!folded) return;
                if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > TAP_PX) return;
                e.stopPropagation();
                onUnfold();
              }}
            >
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
            <Collapse open={!folded}>
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
                <p className="px-2 pb-1 text-center text-xs text-muted-foreground">
                  {t.swipe.hint}
                </p>
              )}
            </Collapse>
          </>
        )}

        {deck.error && (
          <Notice tone="error" bare className="mt-1">
            {deck.error}
          </Notice>
        )}
      </div>
      {/* Words for screen readers as the cards move. */}
      <p className="sr-only" aria-live="polite">
        {current
          ? `${t.swipe.dateOf(index + 1, dates.length)}: ${formatEventDate(event.settings.kind, current, lang)}`
          : t.swipe.doneTitle}
      </p>
    </div>
  );
}
