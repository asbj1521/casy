import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Minus, Plus, SlidersHorizontal, Sparkles } from "lucide-react";

import DaySlider from "@/components/DaySlider";
import Dropdown from "@/components/Dropdown";
import type { ComingSoonSection } from "@/components/findDate/comingSoon";
import ComingSoonSettings from "@/components/findDate/ComingSoonSettings";
import { PlaceNoteSettings, VoteSettings } from "@/components/findDate/EventExtraSettings";
import ParticipantSettings, {
  type ParticipantProps,
} from "@/components/findDate/ParticipantSettings";
import PeriodPicker from "@/components/PeriodPicker";
import Popover from "@/components/Popover";
import Switch from "@/components/ui/Switch";
import type { Messages } from "@/i18n/da";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import {
  ALL_DOWS,
  describeDays,
  MAX_SPAN_DAYS,
  MAX_TRIP_DAYS,
  type EventExtras,
  type SchedulerSettings,
} from "@/lib/scheduler";
import type { PlanField } from "@/lib/aiPlan";
import { nameList } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * What the scheduling page searches for, set in one of three shapes of the
 * same controls: a box of tabs beside the answer on a wide screen
 * (SettingsPanel, #98), a sentence you fill in on tablets ("fra kl. 18:00 i
 * 3 t på alle dage"), with Flere indstillinger a tap away, and a step of its
 * own in the phone's flow (StepSettings, #101). All three edit the same
 * settings and show only what applies: time, length and weekdays for one
 * meeting, or number of days and a start day for a trip or holiday, and in
 * both modes when (the months searched, #74). The name is only for the group
 * to read; the search never looks at it.
 */

/** How long a meeting lasts: 30 min to 12 hours, in 30 minute steps. */
const DURATION_VALUES = Array.from({ length: 24 }, (_, i) => (i + 1) * 30);

/** Which hour a meeting starts: any hour of the day. */
const START_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  label: `${String(h).padStart(2, "0")}:00`,
  value: h,
}));

/** The longest event name the server keeps (MAX_EVENT_TITLE_LENGTH). */
const MAX_NAME_LENGTH = 60;

/** Stands for "any day" where a start day is picked from numbers. */
const ANY_DAY = -1;
/** Stands for "any time" atop the start-hour dropdown, same trick as ANY_DAY. */
const ANY_TIME = -1;

/** startsAt's options, "any time" first. */
function startHourOptions(t: Messages) {
  return [{ label: t.scheduler.anyTime, value: ANY_TIME }, ...START_OPTIONS];
}

/** Maps a startsAt pick back onto the settings, "any time" included. */
function pickStartHour(value: number, onChange: (patch: Partial<SchedulerSettings>) => void) {
  onChange(value === ANY_TIME ? { anyTime: true } : { startHour: value, anyTime: false });
}

interface Props {
  /** The group picker, drawn by the page (it knows the groups). */
  groupSwitcher: ReactNode;
  name: string;
  onName: (name: string) => void;
  settings: SchedulerSettings;
  onChange: (patch: Partial<SchedulerSettings>) => void;
}

/** "fredag" / "Friday" for a day of week (0 = Sunday). */
function weekdayLong(dow: number, locale: string): string {
  // 21 June 2026 is a Sunday; the time zone doesn't matter at noon UTC.
  return new Date(Date.UTC(2026, 5, 21 + dow, 12)).toLocaleDateString(locale, {
    weekday: "long",
    timeZone: "UTC",
  });
}

function useDayValues(settings: SchedulerSettings) {
  const max = settings.startDow === null ? MAX_SPAN_DAYS : MAX_TRIP_DAYS;
  return Array.from({ length: max }, (_, i) => i + 1);
}

/** A value you step through with minus and plus, never opening a menu. */
function Stepper({
  value,
  values,
  format,
  onChange,
  lessLabel,
  moreLabel,
  fill = false,
}: {
  value: number;
  values: number[];
  format: (v: number) => string;
  onChange: (v: number) => void;
  lessLabel: string;
  moreLabel: string;
  /** As wide as its cell, the value centred between the buttons (the phone's flow). */
  fill?: boolean;
}) {
  const i = values.indexOf(value);
  const step = (d: number) => {
    const next = values[i + d];
    if (next !== undefined) onChange(next);
  };
  return (
    <div
      className={cn(
        "flex h-12 items-center rounded-xl border bg-card",
        fill && "w-full justify-between",
      )}
    >
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={i <= 0}
        aria-label={lessLabel}
        className="flex h-full w-10 items-center justify-center rounded-l-xl text-foreground transition hover:bg-secondary disabled:opacity-30"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-[4.5rem] whitespace-nowrap text-center text-base font-bold text-foreground">
        {format(value)}
      </span>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={i < 0 || i >= values.length - 1}
        aria-label={moreLabel}
        className="flex h-full w-10 items-center justify-center rounded-r-xl text-foreground transition hover:bg-secondary disabled:opacity-30"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/** A label above its control, as every field in the wide bar has. */
function Field({
  label,
  mark,
  children,
}: {
  label: ReactNode;
  /** A word after the label, such as "guessed" for a setting Casy's AI guessed (#100). */
  mark?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <span
        className={cn(
          "text-xs font-bold uppercase tracking-wide text-muted-foreground",
          mark && "flex items-center gap-1.5",
        )}
      >
        {label}
        {mark && (
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold normal-case tracking-normal text-amber-800">
            {mark}
          </span>
        )}
      </span>
      {children}
    </div>
  );
}

/** "Alle dage" plus the seven weekdays: the one day a trip starts on. */
function StartDayPicker({
  value,
  onChange,
  fill = false,
}: {
  value: number | null;
  onChange: (dow: number | null) => void;
  /** Share the whole width (the phone's flow), rather than fixed-width days. */
  fill?: boolean;
}) {
  const t = useT();
  const base = "h-12 rounded-lg text-sm font-bold transition-colors";
  const on = "bg-primary text-primary-foreground";
  const off = "border bg-card text-muted-foreground hover:text-foreground";
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        className={cn(base, "mr-1.5 px-3", fill && "shrink-0", value === null ? on : off)}
      >
        {t.scheduler.anyDay}
      </button>
      {ALL_DOWS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          aria-pressed={value === d}
          className={cn(base, fill ? "min-w-0 flex-1" : "w-9", value === d ? on : off)}
        >
          {t.weekdaysShort[d].charAt(0)}
        </button>
      ))}
    </div>
  );
}

/**
 * The settings box's tabs, in the order a plan is made: when, who, where,
 * how often, how the group answers, and what to take into account (#98).
 */
const TABS = ["time", "people", "place", "repeat", "vote", "prefs"] as const;
type Tab = (typeof TABS)[number];

/** Meeting or Tur / ferie, as two halves of one control. */
function KindChoice({
  multiDay,
  onChange,
  fill = false,
}: {
  multiDay: boolean;
  onChange: (multiDay: boolean) => void;
  /** Two equal halves across the whole width (the phone's flow). */
  fill?: boolean;
}) {
  const t = useT();
  return (
    <div
      role="radiogroup"
      aria-label={t.settingsPanel.kind}
      className="flex h-12 items-center gap-1 rounded-xl border bg-secondary/60 p-1"
    >
      {[false, true].map((value) => (
        <button
          key={String(value)}
          type="button"
          role="radio"
          aria-checked={multiDay === value}
          onClick={() => onChange(value)}
          className={cn(
            "h-full whitespace-nowrap rounded-lg px-4 text-base font-bold transition-colors",
            fill && "flex-1",
            multiDay === value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {value ? t.settingsPanel.trip : t.settingsPanel.meeting}
        </button>
      ))}
    </div>
  );
}

/** The Tidspunkt tab: the kind of event and when, then its time or its days. */
function TimeSettings({
  settings,
  onChange,
  guessed = [],
}: Pick<Props, "settings" | "onChange"> & { guessed?: readonly PlanField[] }) {
  const t = useT();
  const dayValues = useDayValues(settings);
  const mark = (field: PlanField) => (guessed.includes(field) ? t.aiPlan.guessed : null);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <Field label={t.settingsPanel.kind} mark={mark("kind")}>
          <KindChoice
            multiDay={settings.multiDay}
            onChange={(multiDay) => onChange({ multiDay })}
          />
        </Field>
        <Field label={t.scheduler.when} mark={mark("months")}>
          <PeriodPicker
            value={settings.period}
            onChange={(period) => onChange({ period })}
            capitalized
            triggerClassName="inline-flex h-12 items-center gap-2 whitespace-nowrap rounded-xl border bg-card px-3.5 text-base font-bold text-foreground transition hover:bg-secondary"
            suffix={<ChevronDown className="h-4 w-4 text-muted-foreground" />}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        {settings.multiDay ? (
          <>
            <Field label={t.scheduler.tripDays} mark={mark("days")}>
              <Stepper
                value={settings.days}
                values={dayValues}
                format={t.common.days}
                onChange={(days) => onChange({ days })}
                lessLabel={t.scheduler.fewerDays}
                moreLabel={t.scheduler.moreDays}
              />
            </Field>
            <Field label={t.scheduler.tripStarts} mark={mark("startWeekday")}>
              <StartDayPicker
                value={settings.startDow}
                onChange={(startDow) => onChange({ startDow })}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label={t.scheduler.startsAt} mark={mark("startHour")}>
              <Dropdown
                value={settings.anyTime ? ANY_TIME : settings.startHour}
                options={startHourOptions(t)}
                onChange={(value) => pickStartHour(value, onChange)}
                suffix={<ChevronDown className="h-4 w-4 text-muted-foreground" />}
                triggerClassName="inline-flex h-12 items-center gap-2 rounded-xl border bg-card px-3.5 text-base font-bold text-foreground transition hover:bg-secondary"
              />
            </Field>
            <Field label={t.scheduler.duration} mark={mark("durationMinutes")}>
              <Stepper
                value={settings.durationMinutes}
                values={DURATION_VALUES}
                format={t.common.duration}
                onChange={(durationMinutes) => onChange({ durationMinutes })}
                lessLabel={t.scheduler.shorter}
                moreLabel={t.scheduler.longer}
              />
            </Field>
            <Field label={t.scheduler.dayLabel} mark={mark("weekdays")}>
              <div className="w-56 2xl:w-72">
                <DaySlider
                  size="lg"
                  selected={settings.dows}
                  onChange={(dows) => onChange({ dows })}
                />
              </div>
            </Field>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The computer's settings box, beside the answer (#98): the group and the
 * name always in view, everything else in tabs. Every tab is drawn in the
 * same grid cell, the hidden ones invisible, so the box is always as tall
 * as its tallest tab: switching tabs never moves the chart below.
 */
export function SettingsPanel({
  groupSwitcher,
  name,
  onName,
  settings,
  onChange,
  extras,
  onExtras,
  participants,
  ai,
  className,
}: Props & {
  /** The place, note and vote settings (#84, #99). */
  extras: EventExtras;
  onExtras: (patch: Partial<EventExtras>) => void;
  /** Who the event is for (#89). */
  participants: ParticipantProps;
  /**
   * Planning with AI (#100), for someone signed in: the view that takes the
   * whole box (given a way back to the settings), and what Casy guessed, to
   * mark on Tidspunkt.
   */
  ai?: { view: (close: () => void) => ReactNode; guessed: readonly PlanField[] };
  className?: string;
}) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("time");
  const [aiOpen, setAiOpen] = useState(false);
  // Whether the AI's panel has grown past the box, to lift it with a shadow.
  const [grown, setGrown] = useState(false);
  const boxRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = panelRef.current;
    const box = boxRef.current;
    if (!aiOpen || !panel || !box) return;
    // Called once on observing, and again on every change of either size.
    const observer = new ResizeObserver(() => setGrown(panel.offsetHeight > box.offsetHeight + 4));
    observer.observe(panel);
    observer.observe(box);
    return () => observer.disconnect();
  }, [aiOpen]);
  const id = useId();

  // Left and right move between tabs, as in any tab list.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = TABS[(TABS.indexOf(tab) + step + TABS.length) % TABS.length];
    setTab(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  }
  const closeAi = () => {
    setAiOpen(false);
    setTab("time");
  };
  // The same width and place in the AI view below, so the picker never moves.
  const group = <div className="w-60 shrink-0 2xl:w-72">{groupSwitcher}</div>;

  return (
    <section
      ref={boxRef}
      className={cn(
        "relative hidden flex-col rounded-2xl border bg-card p-5 shadow-sm xl:flex",
        className,
      )}
    >
      {/* The settings stay drawn under the AI's view, unseen, so the box keeps
          the height they give it and the chart below never moves. */}
      <div
        className={cn("flex flex-1 flex-col", aiOpen && "invisible")}
        inert={aiOpen}
        aria-hidden={aiOpen}
      >
        <div className="flex items-center gap-4">
          {group}
          <label className="min-w-0 flex-1">
            <input
              type="text"
              aria-label={t.scheduler.name}
              value={name}
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => onName(e.target.value)}
              placeholder={t.scheduler.namePlaceholder}
              className="h-[42px] w-full rounded-lg border bg-card px-3.5 text-base font-bold text-foreground outline-none transition placeholder:font-medium placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          {ai && (
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="inline-flex h-[42px] shrink-0 items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 text-sm font-bold text-orange-900 transition hover:bg-orange-100"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              {t.aiPlan.start}
            </button>
          )}
        </div>

        <div
          role="tablist"
          aria-label={t.settingsPanel.tabsLabel}
          onKeyDown={onKeyDown}
          className="mt-3 flex gap-1 overflow-x-auto border-b"
        >
          {TABS.map((key) => (
            <button
              key={key}
              id={`${id}-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={tab === key}
              aria-controls={`${id}-panel-${key}`}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key)}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-2 pb-2 pt-1 text-sm font-semibold transition-colors 2xl:px-3",
                tab === key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.settingsPanel.tabs[key]}
            </button>
          ))}
        </div>

        <div className="mt-3 grid flex-1">
          {TABS.map((key) => (
            <div
              key={key}
              id={`${id}-panel-${key}`}
              role="tabpanel"
              aria-labelledby={`${id}-tab-${key}`}
              aria-hidden={tab !== key}
              // inert keeps a hidden tab's controls out of reach; invisible keeps its size.
              inert={tab !== key}
              className={cn("[grid-area:1/1]", tab !== key && "invisible")}
            >
              {key === "time" ? (
                <TimeSettings settings={settings} onChange={onChange} guessed={ai?.guessed} />
              ) : key === "people" ? (
                <ParticipantSettings {...participants} />
              ) : key === "place" ? (
                <PlaceNoteSettings extras={extras} onChange={onExtras} />
              ) : key === "vote" ? (
                <VoteSettings extras={extras} onChange={onExtras} />
              ) : (
                <ComingSoonSettings section={key satisfies ComingSoonSection} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Planning with AI (#100): the whole box, the group still at hand. It
          is as tall as the box, and when Casy's questions need more room it
          reaches down over the chart, as far as it needs and no further than
          near the bottom of the window (then it scrolls); the answer stays in
          view beside it, and closing it leaves the page as it was. */}
      {ai && aiOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t.aiPlan.start}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeAi();
          }}
          className={cn(
            "absolute -left-px -right-px -top-px z-20 flex max-h-[min(44rem,calc(100dvh_-_8rem))] min-h-[calc(100%_+_2px)] flex-col rounded-2xl border bg-card p-5 transition-shadow",
            grown ? "shadow-xl" : "shadow-sm",
          )}
        >
          <div className="flex items-center gap-4">
            {group}
            <h2 className="flex h-[42px] min-w-0 flex-1 items-center gap-1.5 text-base font-extrabold text-foreground">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{t.aiPlan.start}</span>
            </h2>
            <button
              type="button"
              onClick={closeAi}
              className="inline-flex h-[42px] shrink-0 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-bold text-foreground transition hover:bg-secondary"
            >
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              {t.aiPlan.backToSettings}
            </button>
          </div>
          <div className="mt-3 min-h-0 overflow-y-auto">{ai.view(closeAi)}</div>
        </div>
      )}
    </section>
  );
}

/**
 * The phone flow's "Hvad og hvornår" step (#101): the name and the time
 * settings as a form, one labelled field under another, with the room a
 * screen of its own gives them. The group is picked a step earlier.
 */
export function StepSettings({
  name,
  onName,
  settings,
  onChange,
  guessed = [],
}: Omit<Props, "groupSwitcher"> & {
  /** Settings Casy's AI guessed (#100), marked until changed. */
  guessed?: readonly PlanField[];
}) {
  const t = useT();
  const mark = (field: PlanField) => (guessed.includes(field) ? t.aiPlan.guessed : null);
  const dayValues = useDayValues(settings);
  const chevron = <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />;
  // Every field fills its cell: the whole row, or one of two equal halves.
  const trigger =
    "flex h-12 w-full items-center justify-between gap-2 whitespace-nowrap rounded-xl border bg-card px-3.5 text-base font-bold text-foreground transition hover:bg-secondary";
  const period = (
    <Field label={t.scheduler.when} mark={mark("months")}>
      <PeriodPicker
        value={settings.period}
        onChange={(period) => onChange({ period })}
        capitalized
        className="block"
        triggerClassName={trigger}
        suffix={chevron}
        sheet={{ title: t.scheduler.when }}
      />
    </Field>
  );
  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {t.scheduler.name}
        </span>
        <input
          type="text"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          onChange={(e) => onName(e.target.value)}
          placeholder={t.scheduler.namePlaceholder}
          className="h-12 w-full rounded-xl border bg-card px-3.5 text-[17px] font-bold text-foreground outline-none transition placeholder:font-medium placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>
      <Field label={t.settingsPanel.kind} mark={mark("kind")}>
        <KindChoice
          fill
          multiDay={settings.multiDay}
          onChange={(multiDay) => onChange({ multiDay })}
        />
      </Field>
      {settings.multiDay ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.scheduler.tripDays} mark={mark("days")}>
              <Stepper
                fill
                value={settings.days}
                values={dayValues}
                format={t.common.days}
                onChange={(days) => onChange({ days })}
                lessLabel={t.scheduler.fewerDays}
                moreLabel={t.scheduler.moreDays}
              />
            </Field>
            {period}
          </div>
          <Field label={t.scheduler.tripStarts} mark={mark("startWeekday")}>
            <StartDayPicker
              fill
              value={settings.startDow}
              onChange={(startDow) => onChange({ startDow })}
            />
          </Field>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.scheduler.startsAt} mark={mark("startHour")}>
              <Dropdown
                value={settings.anyTime ? ANY_TIME : settings.startHour}
                options={startHourOptions(t)}
                onChange={(value) => pickStartHour(value, onChange)}
                className="block min-w-0"
                suffix={chevron}
                triggerClassName={trigger}
                sheet={{ title: t.scheduler.startsAt, doneLabel: t.schedulerFlow.done }}
              />
            </Field>
            <Field label={t.scheduler.duration} mark={mark("durationMinutes")}>
              <Stepper
                fill
                value={settings.durationMinutes}
                values={DURATION_VALUES}
                format={t.common.duration}
                onChange={(durationMinutes) => onChange({ durationMinutes })}
                lessLabel={t.scheduler.shorter}
                moreLabel={t.scheduler.longer}
              />
            </Field>
          </div>
          <Field label={t.scheduler.dayLabel} mark={mark("weekdays")}>
            <DaySlider size="lg" selected={settings.dows} onChange={(dows) => onChange({ dows })} />
          </Field>
          {period}
        </>
      )}
    </div>
  );
}

const CHIP =
  "inline-flex min-h-10 items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 text-[17px] font-bold text-orange-900 transition hover:bg-orange-100";

/** The phone version: fill in the blanks of a sentence. */
export function SettingsSentence({ groupSwitcher, name, onName, settings, onChange }: Props) {
  const t = useT();
  const { lang } = useLang();
  const dayValues = useDayValues(settings);
  const chevron = <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />;

  const dayList = describeDays(settings.dows);
  const dayListLabel =
    dayList.kind === "list"
      ? nameList(
          dayList.dows.map((d) =>
            lang === "da" ? t.weekdaysShort[d].toLowerCase() : t.weekdaysShort[d],
          ),
          lang,
        )
      : t.scheduler.dayList[dayList.kind];

  const startDayOptions = [
    { label: t.scheduler.sentenceAnyDay, value: ANY_DAY },
    ...ALL_DOWS.map((d) => ({ label: weekdayLong(d, LOCALE[lang]), value: d })),
  ];

  return (
    <section className="rounded-2xl border bg-card p-3 shadow-sm sm:p-4 xl:hidden">
      {/* The group and the Tur / ferie switch share a line, and every field
          below is a little tighter than its wide-screen counterpart, so the
          chart under the answer still makes the first screen on a phone. */}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">{groupSwitcher}</div>
        <div className="flex shrink-0 flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {t.scheduler.tripToggle}
          </span>
          <Switch
            checked={settings.multiDay}
            onChange={(multiDay) => onChange({ multiDay })}
            label={t.scheduler.tripToggleAria}
            size="lg"
            className="my-[3px]"
          />
        </div>
        {/* Flere indstillinger (#98): on this line, so the sentence's box
            doesn't grow and push the chart off the first screen. */}
        <div className="flex shrink-0 flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {t.settingsPanel.moreShort}
          </span>
          <Link
            to={{ search: "?settings" }}
            aria-label={t.settingsPanel.more}
            title={t.settingsPanel.more}
            className="my-[3px] flex h-[30px] w-[52px] items-center justify-center rounded-full border bg-card text-foreground transition hover:bg-secondary"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <input
        type="text"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        onChange={(e) => onName(e.target.value)}
        placeholder={t.scheduler.namePlaceholder}
        aria-label={t.scheduler.name}
        className="mt-1.5 h-11 w-full rounded-xl border bg-card px-3.5 text-[17px] font-bold text-foreground outline-none transition placeholder:font-medium placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
      />

      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-[17px] font-semibold text-foreground">
        {settings.multiDay ? (
          <>
            <span>{t.scheduler.sentenceFor}</span>
            <Dropdown
              value={settings.days}
              options={dayValues.map((d) => ({ label: t.common.days(d), value: d }))}
              onChange={(days) => onChange({ days })}
              triggerClassName={CHIP}
              suffix={chevron}
            />
            <span>{t.scheduler.sentenceFrom}</span>
            <Dropdown
              value={settings.startDow ?? ANY_DAY}
              options={startDayOptions}
              onChange={(v) => onChange({ startDow: v === ANY_DAY ? null : v })}
              triggerClassName={CHIP}
              suffix={chevron}
              menuWidth="w-56"
            />
          </>
        ) : (
          <>
            {/* "Whenever, for 3h..." reads fine without a leading "at"; a
                fixed hour still needs it ("at 18:00, for 3h..."). */}
            {!settings.anyTime && <span>{t.scheduler.sentenceAt}</span>}
            <Dropdown
              value={settings.anyTime ? ANY_TIME : settings.startHour}
              options={startHourOptions(t)}
              onChange={(value) => pickStartHour(value, onChange)}
              triggerClassName={CHIP}
              suffix={chevron}
            />
            <span>{t.scheduler.sentenceFor}</span>
            <Dropdown
              value={settings.durationMinutes}
              options={DURATION_VALUES.map((v) => ({ label: t.common.duration(v), value: v }))}
              onChange={(durationMinutes) => onChange({ durationMinutes })}
              triggerClassName={CHIP}
              suffix={chevron}
            />
            <span>{t.scheduler.sentenceOn}</span>
            <Popover
              className="inline-block"
              triggerClassName={CHIP}
              panelClassName="w-72 p-2"
              trigger={() => (
                <>
                  {dayListLabel}
                  {chevron}
                </>
              )}
            >
              {() => <DaySlider selected={settings.dows} onChange={(dows) => onChange({ dows })} />}
            </Popover>
          </>
        )}
        <PeriodPicker
          value={settings.period}
          onChange={(period) => onChange({ period })}
          triggerClassName={CHIP}
          suffix={chevron}
        />
      </div>
    </section>
  );
}
