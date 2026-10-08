import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { CalendarRange, ChevronDown, Hourglass, Loader2, MapPin, RotateCcw } from "lucide-react";

import type { EventResponse } from "@/api/events";
import Dropdown from "@/components/Dropdown";
import EdgeWarningList from "@/components/EdgeWarningList";
import CalendarSheet from "@/components/swipe/CalendarSheet";
import CalendarStrip from "@/components/swipe/CalendarStrip";
import { clashesOn } from "@/components/swipe/clash";
import { AnswerButtons, AnswerIcon, SwipeCard, type Exit } from "@/components/swipe/SwipeCard";
import YourTime from "@/components/time/YourTime";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { TODAY } from "@/hooks/useDateSearch";
import { useMyCalendarDays, type MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { useLang, useT } from "@/i18n/lang";
import type { EdgeWarning } from "@/lib/earlyMorning";
import type { EventSettings } from "@/lib/eventSearch";
import { formatHeadline, nameList } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import {
  ANSWER_DAY_VALUES,
  DATE_COUNT_VALUES,
  daysUntil,
  type EventExtras,
  type FoundDate,
} from "@/lib/scheduler";
import { cn } from "@/lib/utils";
import { APP_TIME_ZONE, dayOf, startOfDay } from "@/lib/zone";
import type { TimeSlot } from "@/types";

import FieldRow, { ROW_PICK } from "./FieldRow";

const TZ = APP_TIME_ZONE;

/** Your answer to a date before it is sent: "can't" removes it instead. */
export type DraftAnswer = "accepted" | "maybe";

/**
 * The flow's last step (#101): you swipe the dates yourself before they go,
 * exactly as everyone in the group will afterwards, with your own calendar
 * around each one under the card. Right "can", up "can, but rather not",
 * left removes the date, and the page finds another in its place. Once every
 * date has an answer, a summary: the dates with your answers (tap one to
 * change it), how the vote runs, and the button that sends them.
 *
 * The dates and answers belong to the page (FindDate): this draws them.
 */
export default function DraftDeck({
  waiting,
  dates,
  answers,
  onAnswer,
  onReopen,
  onUndo,
  canUndo,
  onStartOver,
  anyRemoved,
  search,
  slotLabel,
  place,
  groupSize,
  warningsFor,
  extras,
  onExtras,
  notes,
}: {
  /** Why there is nothing to swipe yet: calendars loading, or none to search. */
  waiting: { text: string; loading: boolean } | null;
  /** The dates going into the vote, soonest first; null when none were searched. */
  dates: FoundDate[] | null;
  /** Your answers so far, by each date's start. */
  answers: Record<string, DraftAnswer>;
  /** An answer to the date at `start`; "declined" takes it out. */
  onAnswer: (start: string, response: EventResponse) => void;
  /** Answer the date at `start` again. */
  onReopen: (start: string) => void;
  onUndo: () => void;
  canUndo: boolean;
  /** Put back every date taken out. */
  onStartOver: () => void;
  anyRemoved: boolean;
  search: EventSettings;
  /** What the event is called, for the calendar under the card. */
  slotLabel: string;
  place: string;
  /** How many people the search covers, for "3 af 4 kan". */
  groupSize: number;
  /** A meeting's edge warnings for one date (earlyMorning.ts). */
  warningsFor: (slot: TimeSlot) => EdgeWarning[];
  extras: EventExtras;
  onExtras: (patch: Partial<EventExtras>) => void;
  /** What else to say under the summary: who checks dates by hand, how sending went. */
  notes: ReactNode;
}) {
  const t = useT();
  const words = t.schedulerFlow;
  const calendar = useMyCalendarDays();
  const [exit, setExit] = useState<Exit>("accepted");
  const [calendarFrom, setCalendarFrom] = useState<DOMRect | null>(null);
  const marked = useMemo(
    () => new Set((dates ?? []).map((d) => startOfDay(Date.parse(d.slot.start), TZ))),
    [dates],
  );

  if (waiting) {
    return (
      <p className="flex items-center gap-2 text-[15px] text-muted-foreground">
        {waiting.loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
        {waiting.text}
      </p>
    );
  }
  if (!dates || dates.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-[15px] text-rose-800">{anyRemoved ? words.noMore : words.noDate}</p>
        {anyRemoved && (
          <button
            type="button"
            onClick={onStartOver}
            className="rounded-xl border bg-card px-4 py-2.5 text-[15px] font-semibold text-foreground"
          >
            {words.startOver}
          </button>
        )}
      </div>
    );
  }

  const index = dates.findIndex((d) => !answers[d.slot.start]);
  const current = index === -1 ? null : dates[index];

  if (!current) {
    return (
      <Summary
        dates={dates}
        answers={answers}
        onReopen={onReopen}
        search={search}
        extras={extras}
        onExtras={onExtras}
        notes={notes}
      />
    );
  }

  function answer(response: EventResponse) {
    if (!current) return;
    setExit(response);
    haptic("answer");
    onAnswer(current.slot.start, response);
  }
  const next = dates.slice(index + 1).find((d) => !answers[d.slot.start]);
  const face = (date: FoundDate, position: number) => (
    <DraftCard
      date={date}
      position={position}
      total={dates.length}
      search={search}
      place={place}
      groupSize={groupSize}
      warnings={warningsFor(date.slot)}
      calendar={calendar}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* How far along, and a step back. */}
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 gap-1">
          {dates.map((d, i) => {
            const a = answers[d.slot.start];
            return (
              <span
                key={d.slot.start}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i === index
                    ? "bg-foreground"
                    : a === "accepted"
                      ? "bg-emerald-500"
                      : a === "maybe"
                        ? "bg-amber-400"
                        : "bg-secondary",
                )}
              />
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            setExit("back");
            onUndo();
          }}
          disabled={!canUndo}
          aria-label={words.undo}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-card text-amber-600 shadow-sm transition disabled:opacity-30"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div className="relative mt-3 min-h-[220px] flex-1">
        {next && (
          <div aria-hidden className="absolute inset-0 translate-y-2 scale-[0.96] opacity-60">
            {face(next, dates.indexOf(next) + 1)}
          </div>
        )}
        <AnimatePresence custom={exit} initial={false}>
          <SwipeCard key={current.slot.start} exitTo={exit} onAnswer={answer} draggable>
            {face(current, index + 1)}
          </SwipeCard>
        </AnimatePresence>
      </div>

      <div className="mt-3">
        <CalendarStrip
          key={current.slot.start}
          date={current.slot}
          slotLabel={slotLabel}
          calendar={calendar}
          onOpen={setCalendarFrom}
        />
      </div>
      <AnswerButtons onAnswer={answer} screen />
      {Object.keys(answers).length === 0 && !anyRemoved && (
        <p className="px-2 text-center text-xs text-muted-foreground">{words.deckHint}</p>
      )}

      {calendarFrom && (
        <CalendarSheet
          date={current.slot}
          slotLabel={slotLabel}
          marked={marked}
          calendar={calendar}
          from={calendarFrom}
          onClose={() => setCalendarFrom(null)}
        />
      )}
      {/* Words for screen readers as the cards move. */}
      <p className="sr-only" aria-live="polite">
        {t.swipe.dateOf(index + 1, dates.length)}
      </p>
    </div>
  );
}

/**
 * What a card says before sending: the date, how soon, what you have then,
 * and how the rest of the group stands by their calendars.
 */
function DraftCard({
  date,
  position,
  total,
  search,
  place,
  groupSize,
  warnings,
  calendar,
}: {
  date: FoundDate;
  position: number;
  total: number;
  search: EventSettings;
  place: string;
  groupSize: number;
  warnings: EdgeWarning[];
  calendar: MyCalendarDays;
}) {
  const t = useT();
  const { lang } = useLang();
  const { slot, conflicts, absent = [] } = date;
  const headline = formatHeadline(search, slot, lang, t);
  const clash = clashesOn(slot, calendar);
  const names = (list: { name: string }[]) =>
    nameList(
      list.map((p) => p.name),
      lang,
    );

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
        <YourTime kind={search.kind} date={slot} />
      </p>
      <p className="text-sm text-muted-foreground">
        {t.scheduler.inDays(daysUntil(dayOf(slot.start, TZ), TODAY))}
      </p>
      {clash && (
        <p className="mt-2 text-sm font-medium text-rose-700">
          {t.swipe.clash(clash.label, clash.when, clash.more)}
        </p>
      )}
      <EdgeWarningList warnings={warnings} className="mt-2" />
      {place.trim() && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="truncate">{place.trim()}</span>
        </p>
      )}

      <div className="mt-auto pt-3 text-sm">
        <p className="font-semibold text-foreground">
          {t.scheduler.countCan(groupSize - conflicts.length - absent.length, groupSize)}
        </p>
        {conflicts.length > 0 && (
          <p className="text-amber-800">
            {search.kind === "single"
              ? t.schedulerFlow.needSkip(names(conflicts))
              : t.schedulerFlow.needTimeOff(names(conflicts))}
          </p>
        )}
        {absent.length > 0 && (
          <p className="text-muted-foreground">{t.scheduler.absent(names(absent))}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Every date answered: what goes to the group, with your answers (tap one to
 * change it), and how the vote runs, beside the dates it is about.
 */
function Summary({
  dates,
  answers,
  onReopen,
  search,
  extras,
  onExtras,
  notes,
}: {
  dates: FoundDate[];
  answers: Record<string, DraftAnswer>;
  onReopen: (start: string) => void;
  search: EventSettings;
  extras: EventExtras;
  onExtras: (patch: Partial<EventExtras>) => void;
  notes: ReactNode;
}) {
  const t = useT();
  const { lang } = useLang();
  const words = t.settingsPanel.vote;
  const chevron = <ChevronDown className="h-4 w-4 shrink-0" />;

  return (
    <div>
      <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
        {t.schedulerFlow.readyTitle(dates.length)}
      </h2>
      <p className="mt-1 text-[15px] text-muted-foreground">{t.schedulerFlow.readyBody}</p>

      <ListGroup
        className="mt-4"
        footnote={dates.length === 1 ? t.schedulerFlow.onlyOne : t.swipe.tapToChange}
      >
        {dates.map(({ slot }) => {
          const { lines, time } = formatHeadline(search, slot, lang, t);
          const a = answers[slot.start];
          return (
            <ListRow
              key={slot.start}
              label={lines.join(" ")}
              detail={time}
              value={
                a && (
                  <span
                    className={cn(
                      "flex items-center gap-1 text-xs font-semibold",
                      a === "accepted" ? "text-emerald-700" : "text-amber-700",
                    )}
                  >
                    <AnswerIcon answer={a} />
                    {t.swipe.answerWord[a]}
                  </span>
                )
              }
              chevron
              onClick={() => onReopen(slot.start)}
            />
          );
        })}
      </ListGroup>

      <ListGroup title={t.settingsPanel.tabs.vote}>
        <FieldRow icon={CalendarRange} label={words.dates} labelled={false}>
          <Dropdown
            value={extras.dateCount}
            options={DATE_COUNT_VALUES.map((n) => ({ label: words.upTo(n), value: n }))}
            onChange={(dateCount) => onExtras({ dateCount })}
            suffix={chevron}
            triggerClassName={ROW_PICK}
            sheet={{ title: words.dates, doneLabel: t.schedulerFlow.done }}
          />
        </FieldRow>
        <FieldRow icon={Hourglass} label={words.deadline} labelled={false}>
          <Dropdown
            value={extras.answerDays}
            options={ANSWER_DAY_VALUES.map((d) => ({ label: t.common.days(d), value: d }))}
            onChange={(answerDays) => onExtras({ answerDays })}
            suffix={chevron}
            triggerClassName={ROW_PICK}
            sheet={{ title: words.deadline, doneLabel: t.schedulerFlow.done }}
          />
        </FieldRow>
      </ListGroup>

      {notes && <div className="mt-4 flex flex-col gap-2 px-1 text-sm">{notes}</div>}
    </div>
  );
}
