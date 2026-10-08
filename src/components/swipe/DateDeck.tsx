import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { CalendarCheck, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

import { answerDate, eventsQueryKey, type CandidateDate, type EventResponse } from "@/api/events";
import CalendarSheet from "@/components/swipe/CalendarSheet";
import CalendarStrip from "@/components/swipe/CalendarStrip";
import Celebration from "@/components/swipe/Celebration";
import YourTime from "@/components/time/YourTime";
import Avatar from "@/components/ui/Avatar";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useDecidingRefresh } from "@/hooks/useDecidingRefresh";
import { useMyCalendarDays, type MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { TODAY } from "@/hooks/useDateSearch";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import {
  formatEventDate,
  formatHeadline,
  formatLongDate,
  formatTime,
  nameList,
} from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { daysUntil } from "@/lib/scheduler";
import { cn } from "@/lib/utils";
import {
  firstUnanswered,
  stillToAnswer,
  upcomingDates,
  voteStage,
  type VoteEvent,
} from "@/lib/vote";
import { APP_TIME_ZONE, dayOf, startOfDay } from "@/lib/zone";
import PlaceNote from "@/components/myEvents/PlaceNote";
import { clashesOn } from "@/components/swipe/clash";
import { AnswerButtons, AnswerIcon, SwipeCard, type Exit } from "@/components/swipe/SwipeCard";

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
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  const calendar = useMyCalendarDays();
  // One "now" for the whole visit, so a date beginning mid-swipe doesn't
  // reshuffle the stack under the thumb.
  const [now] = useState(() => Date.now());
  const dates = useMemo(() => upcomingDates(event, now), [event, now]);
  const you = event.invitees.find((i) => i.isYou)?.profileId ?? userId;

  // Answers given here, shown before (and regardless of) the server's reply.
  const [given, setGiven] = useState<Record<string, EventResponse>>({});
  const answerOf = (d: CandidateDate): EventResponse | undefined => given[d.id] ?? d.answers[you];
  const [index, setIndex] = useState(() => {
    const first = firstUnanswered(event, now);
    return first === -1 ? dates.length : first;
  });
  const [exit, setExit] = useState<Exit>("accepted");
  const [celebrate, setCelebrate] = useState(false);
  // The calendar under the card, grown to the whole screen.
  // The whole calendar, open, zoomed out of the strip's place on screen.
  const [calendarFrom, setCalendarFrom] = useState<DOMRect | null>(null);
  const calendarOpen = calendarFrom !== null;
  const [error, setError] = useState<string | null>(null);

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
  // "I can't" on the date already decided moves it for everyone, so it is
  // asked first; and once moved, the new date is said.
  const [confirmMove, setConfirmMove] = useState(false);
  const [moved, setMoved] = useState<string | null>(null);

  function answer(response: EventResponse, confirmed = false) {
    if (!current) return;
    const movesDate =
      event.status === "scheduled" &&
      event.currentDate?.id === current.id &&
      response === "declined";
    if (movesDate && !confirmed) {
      setConfirmMove(true);
      return;
    }
    setConfirmMove(false);
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
    setExit("back");
    setIndex(to);
  }

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
            />
          );
          const hint = index === 0 && !Object.keys(given).length && (
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
                  onCancel={() => setConfirmMove(false)}
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
                    onCancel={() => setConfirmMove(false)}
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

/** What a card says: the date, how soon, what you have then, and how others answered. */
function CardFace({
  event,
  date,
  position,
  total,
  yours,
  calendar,
}: {
  event: VoteEvent;
  date: CandidateDate;
  position: number;
  total: number;
  yours: EventResponse | undefined;
  calendar: MyCalendarDays;
}) {
  const t = useT();
  const { lang } = useLang();
  const headline = formatHeadline(event.settings, date, lang, t);
  const others = event.invitees.filter((i) => !i.isYou);
  const clash = clashesOn(date, calendar);

  return (
    <div className="flex h-full select-none flex-col rounded-3xl border bg-card p-5 shadow-xl shadow-black/10">
      <p className="text-xs font-bold uppercase tracking-wide text-primary">
        {t.swipe.dateOf(position, total)}
      </p>
      <p className="mt-2 text-[28px] font-extrabold leading-[1.1] tracking-tight text-foreground">
        {headline.lines.join(" ")}
      </p>
      <p className="mt-1 text-lg text-foreground">
        {headline.time}
        <YourTime kind={event.settings.kind} date={date} />
      </p>
      <p className="text-sm text-muted-foreground">
        {t.scheduler.inDays(daysUntil(dayOf(date.start, TZ), TODAY))}
      </p>
      {clash && (
        <p className="mt-2 text-sm font-medium text-rose-700">
          {t.swipe.clash(clash.label, clash.when, clash.more)}
        </p>
      )}
      <PlaceNote event={event} readOnly className="mt-3" />

      <div className="mt-auto pt-3">
        {yours && (
          <p className="mb-2 text-sm font-semibold text-foreground">
            {t.swipe.youAnswered(t.swipe.answerWord[yours])}
          </p>
        )}
        {others.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {others.map((p, i) => {
              const a = date.answers[p.profileId];
              return (
                <li
                  key={p.profileId}
                  className={cn(
                    "flex items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-2 text-xs",
                    a === "accepted" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                    a === "maybe" && "border-amber-200 bg-amber-50 text-amber-800",
                    a === "declined" && "border-rose-200 bg-rose-50 text-rose-800",
                    !a && "bg-background text-muted-foreground",
                  )}
                >
                  <Avatar name={p.name} index={i + 1} size="xs" />
                  {p.name}
                  <AnswerIcon answer={a} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * After the last card: your answers (tap one to change it), and where the
 * event stands: settled (with the celebration), waiting for others, or
 * waiting for the suggester's choice.
 */
function DoneView({
  event,
  dates,
  answerOf,
  onChange,
  moved,
  screen,
}: {
  event: VoteEvent;
  dates: CandidateDate[];
  answerOf: (d: CandidateDate) => EventResponse | undefined;
  onChange: (index: number) => void;
  /** The new date, after your answer moved the decided one. */
  moved: string | null;
  screen: boolean;
}) {
  const t = useT();
  const { lang } = useLang();
  const settled = event.status === "scheduled" && event.currentDate;
  const stage = event.status === "pending" ? voteStage(event) : null;
  const missing = event.status === "pending" ? stillToAnswer(event) : [];

  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto", screen ? "px-4 pb-6 pt-5" : "mt-4")}>
      <div className={cn(screen && "mx-auto max-w-md")}>
        {moved && (
          <Notice tone="info" className="mb-4">
            {t.swipe.moved(moved)}
          </Notice>
        )}
        {settled ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
            <CalendarCheck className="h-8 w-8 text-emerald-600" />
            <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-emerald-800">
              {t.swipe.settledTitle}
            </p>
            <p className="mt-1 text-2xl font-extrabold text-foreground">
              {formatEventDate(event.settings.kind, event.currentDate!, lang)}
            </p>
            <Link
              to={`/events/${event.id}`}
              className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              {t.swipe.seeEvent}
            </Link>
            <p className="mt-3 text-sm text-emerald-900/80">{t.swipe.changeAfter}</p>
          </div>
        ) : dates.length === 0 ? (
          <p className="text-muted-foreground">{t.swipe.noDates}</p>
        ) : (
          <>
            <p className="text-2xl font-extrabold text-foreground">{t.swipe.doneTitle}</p>
            <p className="mt-1 text-muted-foreground">
              {stage === "choose"
                ? t.swipe.chooseNow
                : stage === "waitingForChoice"
                  ? t.swipe.waitingForChoice(event.createdBy.name)
                  : missing.length > 0
                    ? t.swipe.waitingFor(nameList(missing, lang))
                    : t.swipe.deciding}
            </p>
            {event.answerBy && missing.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {t.swipe.decidedBy(
                  formatLongDate(event.answerBy, lang),
                  formatTime(event.answerBy),
                )}
              </p>
            )}
            {stage === "choose" && (
              <Link
                to={screen ? "/events" : `/events/${event.id}`}
                className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                {t.swipe.goChoose}
              </Link>
            )}
          </>
        )}

        {dates.length > 0 && (
          <section className="mt-6">
            <h3 className="flex items-baseline justify-between gap-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t.swipe.yourAnswers}
              <span className="text-xs font-medium normal-case tracking-normal">
                {t.swipe.tapToChange}
              </span>
            </h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {dates.map((d, i) => {
                const a = answerOf(d);
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => onChange(i)}
                      aria-label={t.swipe.changeAnswerFor(
                        formatEventDate(event.settings.kind, d, lang),
                      )}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2.5 text-left text-sm transition hover:bg-secondary"
                    >
                      <span className="min-w-0 truncate font-medium text-foreground">
                        {formatEventDate(event.settings.kind, d, lang)}
                      </span>
                      <span
                        className={cn(
                          "flex shrink-0 items-center gap-1 text-xs font-semibold",
                          a === "accepted" && "text-emerald-700",
                          a === "maybe" && "text-amber-700",
                          a === "declined" && "text-rose-700",
                          !a && "text-muted-foreground",
                        )}
                      >
                        <AnswerIcon answer={a} />
                        {a ? t.swipe.answerWord[a] : t.swipe.notAnswered}
                        <ChevronRight className="ml-1 h-4 w-4 text-muted-foreground" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {screen && (
          <Link
            to="/events"
            className="mt-6 inline-flex rounded-full border px-4 py-2 text-sm font-semibold text-foreground"
          >
            {t.swipe.toEvents}
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Asked before "I can't" on a vote's decided date, which moves it for
 * everyone: Casy then decides again from everyone's answers.
 */
function MoveConfirm({
  onConfirm,
  onCancel,
  className,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}) {
  const t = useT();
  return (
    <ConfirmPanel
      className={className}
      message={t.swipe.moveConfirm}
      confirmLabel={t.swipe.moveYes}
      cancelLabel={t.swipe.moveKeep}
      busy={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
