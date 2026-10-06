import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { CalendarCheck, Check, ChevronLeft, Clock, Meh, RotateCcw, X } from "lucide-react";

import { answerDate, eventsQueryKey, type CandidateDate, type EventResponse } from "@/api/events";
import CalendarSheet from "@/components/swipe/CalendarSheet";
import CalendarStrip from "@/components/swipe/CalendarStrip";
import Celebration from "@/components/swipe/Celebration";
import YourTime from "@/components/time/YourTime";
import Avatar from "@/components/ui/Avatar";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useMyCalendarDays, type MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { TODAY } from "@/hooks/useDateSearch";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import { formatSegmentRange } from "@/lib/calendarOverview";
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
import { addDays, APP_TIME_ZONE, dayOf, startOfDay } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/** How far a card must be dragged (px, with a little of its speed) to count as an answer. */
const ANSWER_AT = 110;

/** Which way a card leaves: its answer, or "back" when stepping to the date before. */
type Exit = EventResponse | "back";

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
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (v: { dateId: string; response: EventResponse }) =>
      answerDate(event.id, v.dateId, v.response),
    onSuccess: (data) => {
      queryClient.setQueryData(eventsQueryKey(userId), data.events);
      if (data.outcome === "scheduled") {
        setCelebrate(true);
        haptic("success");
      }
    },
    onError: (err, v) => {
      setGiven((g) => {
        const rest = { ...g };
        delete rest[v.dateId];
        return rest;
      });
      setError(err.message);
      void queryClient.invalidateQueries({ queryKey: eventsQueryKey(userId) });
    },
  });

  // Settled (or called off) while swiping, by someone else's answer: the
  // cards left can't be answered any more, so the outcome shows instead.
  const done = index >= dates.length || event.status !== "pending";
  const current = done ? null : (dates[index] ?? null);

  function answer(response: EventResponse) {
    if (!current) return;
    setError(null);
    setExit(response);
    setGiven((g) => ({ ...g, [current.id]: response }));
    setIndex((i) => i + 1);
    haptic("answer");
    save.mutate({ dateId: current.id, response });
  }
  function back(to = index - 1) {
    if (to < 0) return;
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

  return (
    <div className={cn("flex flex-col", screen ? "h-full" : "")}>
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
        {/* A computer's pane already names the event above the cards. */}
        <div className="min-w-0 flex-1">
          {screen && (
            <>
              <p className="truncate text-[15px] font-semibold text-foreground">
                {eventTitle(event.title, t)}
              </p>
              <p className="truncate text-xs text-muted-foreground">{event.group.name}</p>
            </>
          )}
        </div>
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

      {/* One segment per date: answered, the one on screen, still to come. */}
      <div className={cn("flex gap-1", screen && "px-4")}>
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

      {done ? (
        <DoneView event={event} dates={dates} answerOf={answerOf} onChange={back} screen={screen} />
      ) : (
        current && (
          <>
            <div
              className={cn("relative mt-3", screen ? "min-h-[230px] flex-1 px-4" : "h-[300px]")}
            >
              <div className={cn("relative h-full", screen && "mx-auto max-w-md")}>
                {/* The next date waits underneath, so the stack reads as a stack. */}
                {dates[index + 1] && (
                  <div
                    aria-hidden
                    className="absolute inset-0 translate-y-2 scale-[0.96] opacity-60"
                  >
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
                  <SwipeCard key={current.id} exitTo={exit} onAnswer={answer}>
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
            </div>

            <div className={cn("mt-3", screen && "px-4")}>
              <div className={cn(screen && "mx-auto max-w-md")}>
                <CalendarStrip
                  key={current.id}
                  date={current}
                  slotLabel={slotLabel}
                  calendar={calendar}
                  layoutId={`calendar-${current.id}`}
                  open={calendarOpen}
                  onOpen={() => setCalendarOpen(true)}
                />
              </div>
            </div>

            <AnswerButtons onAnswer={answer} screen={screen} />
            {index === 0 && !Object.keys(given).length && (
              <p
                className={cn(
                  "text-center text-xs text-muted-foreground",
                  screen ? "px-6 pb-2" : "mt-1",
                )}
              >
                {screen ? t.swipe.hint : t.swipe.keysHint}
              </p>
            )}
          </>
        )
      )}

      {error && (
        <Notice tone="error" bare className={cn("mt-2", screen && "px-4")}>
          {error}
        </Notice>
      )}

      {/* Grown out of the strip, and back into it, by their shared layoutId. */}
      {calendarOpen && current && (
        <CalendarSheet
          date={current}
          slotLabel={slotLabel}
          marked={marked}
          calendar={calendar}
          layoutId={`calendar-${current.id}`}
          onClose={() => setCalendarOpen(false)}
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

/** The card on top: follows the thumb, tilts, shows the answer it's heading for. */
function SwipeCard({
  exitTo,
  onAnswer,
  children,
}: {
  exitTo: Exit;
  onAnswer: (response: EventResponse) => void;
  children: ReactNode;
}) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-240, 0, 240], [-14, 0, 14]);
  const yes = useTransform(x, [24, ANSWER_AT], [0, 1]);
  const no = useTransform(x, [-ANSWER_AT, -24], [1, 0]);
  const maybe = useTransform(y, [-ANSWER_AT, -24], [1, 0]);

  // Which answer letting go would give now: a tick under the thumb on entering one.
  const heading = useRef<EventResponse | null>(null);
  const zone = (dx: number, dy: number): EventResponse | null =>
    dx > ANSWER_AT
      ? "accepted"
      : dx < -ANSWER_AT
        ? "declined"
        : dy < -ANSWER_AT && Math.abs(dx) < ANSWER_AT
          ? "maybe"
          : null;
  const track = () => {
    const now = zone(x.get(), y.get());
    if (now && now !== heading.current) haptic("tick");
    heading.current = now;
  };
  useMotionValueEvent(x, "change", track);
  useMotionValueEvent(y, "change", track);

  const away = 640;
  const variants = {
    enter: { scale: 0.96, y: 8, opacity: 0.6 },
    center: { scale: 1, y: 0, opacity: 1 },
    exit: (to: Exit) =>
      reduceMotion || to === "back"
        ? { opacity: 0, scale: 0.96, transition: { duration: 0.15 } }
        : to === "accepted"
          ? { x: away, rotate: 18, opacity: 0, transition: { duration: 0.35 } }
          : to === "declined"
            ? { x: -away, rotate: -18, opacity: 0, transition: { duration: 0.35 } }
            : { y: -away, opacity: 0, transition: { duration: 0.35 } },
  };

  return (
    <motion.div
      className="absolute inset-0 z-10 cursor-grab touch-none active:cursor-grabbing"
      style={{ x, y, rotate: reduceMotion ? 0 : rotate }}
      drag
      dragSnapToOrigin
      dragElastic={0.85}
      custom={exitTo}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: "spring", damping: 26, stiffness: 300 }}
      onDragEnd={(_, info) => {
        // A flick counts as much as a long drag.
        const answer = zone(
          info.offset.x + info.velocity.x * 0.15,
          info.offset.y + info.velocity.y * 0.15,
        );
        heading.current = null;
        if (answer) onAnswer(answer);
      }}
    >
      {children}
      {/* The answer it's heading for, stamped on as it gets there. */}
      <motion.span
        aria-hidden
        style={{ opacity: yes }}
        className="pointer-events-none absolute left-5 top-6 -rotate-12 rounded-lg border-[3px] border-emerald-500 px-2 py-0.5 text-2xl font-extrabold uppercase tracking-wide text-emerald-600"
      >
        {t.swipe.can}
      </motion.span>
      <motion.span
        aria-hidden
        style={{ opacity: no }}
        className="pointer-events-none absolute right-5 top-6 rotate-12 rounded-lg border-[3px] border-rose-500 px-2 py-0.5 text-2xl font-extrabold uppercase tracking-wide text-rose-600"
      >
        {t.swipe.cant}
      </motion.span>
      <motion.span
        aria-hidden
        style={{ opacity: maybe }}
        className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-lg border-[3px] border-amber-500 px-2 py-0.5 text-2xl font-extrabold uppercase tracking-wide text-amber-600"
      >
        {t.swipe.rather}
      </motion.span>
    </motion.div>
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

export function AnswerIcon({ answer }: { answer: EventResponse | undefined | null }) {
  if (answer === "accepted") return <Check className="h-3 w-3" />;
  if (answer === "maybe") return <Meh className="h-3 w-3" />;
  if (answer === "declined") return <X className="h-3 w-3" />;
  return <Clock className="h-3 w-3" />;
}

/**
 * The first thing in your own calendar the date runs into, and how many more:
 * for a meeting, anything during it; for a trip or holiday, anything on its
 * days. Holidays aren't counted: the search already keeps clear of the ones
 * nobody is free on.
 */
function clashesOn(date: CandidateDate, calendar: MyCalendarDays) {
  const start = Date.parse(date.start);
  const end = Date.parse(date.end);
  const hits = [];
  for (let day = startOfDay(start, TZ); day < end; day = addDays(day, 1, TZ)) {
    for (const s of calendar.segmentsOn(new Date(day))) {
      if (!s.holiday && s.start.getTime() < end && s.end.getTime() > start) hits.push(s);
    }
  }
  if (hits.length === 0) return null;
  return {
    label: calendar.labelOf(hits[0]),
    when: formatSegmentRange(hits[0], TZ, ""),
    more: hits.length - 1,
  };
}

/** The three answers as buttons, Tinder-style: can't, rather not (smaller), can. */
function AnswerButtons({
  onAnswer,
  screen,
}: {
  onAnswer: (response: EventResponse) => void;
  screen: boolean;
}) {
  const t = useT();
  const base =
    "flex items-center justify-center rounded-full border-2 bg-card shadow-md transition active:scale-90";
  return (
    <div className={cn("flex items-start justify-center gap-6", screen ? "py-3" : "mt-4")}>
      {(
        [
          ["declined", X, "h-16 w-16 border-rose-200 text-rose-600", "h-8 w-8", t.swipe.cant],
          [
            "maybe",
            Meh,
            "mt-2 h-12 w-12 border-amber-200 text-amber-600",
            "h-6 w-6",
            t.swipe.rather,
          ],
          [
            "accepted",
            Check,
            "h-16 w-16 border-emerald-200 text-emerald-600",
            "h-8 w-8",
            t.swipe.can,
          ],
        ] as const
      ).map(([response, Icon, size, iconSize, label]) => (
        <div key={response} className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => onAnswer(response)}
            aria-label={t.swipe.answerLong[response]}
            className={cn(base, size)}
          >
            <Icon className={iconSize} strokeWidth={2.5} />
          </button>
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        </div>
      ))}
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
  screen,
}: {
  event: VoteEvent;
  dates: CandidateDate[];
  answerOf: (d: CandidateDate) => EventResponse | undefined;
  onChange: (index: number) => void;
  screen: boolean;
}) {
  const t = useT();
  const { lang } = useLang();
  const settled = event.status === "scheduled" && event.currentDate;
  const stage = event.status === "pending" ? voteStage(event) : null;
  const missing = event.status === "pending" ? stillToAnswer(event) : [];

  return (
    <div className={cn("flex-1 overflow-y-auto", screen ? "px-4 pb-6 pt-5" : "mt-4")}>
      <div className={cn(screen && "mx-auto max-w-md")}>
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
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t.swipe.yourAnswers}
            </h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {dates.map((d, i) => {
                const a = answerOf(d);
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => onChange(i)}
                      disabled={!!settled}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2.5 text-left text-sm transition hover:bg-secondary disabled:hover:bg-card"
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
