import { type ReactNode } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";

import DaySlider from "@/components/DaySlider";
import Dropdown from "@/components/Dropdown";
import Popover from "@/components/Popover";
import type { Messages } from "@/i18n/da";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import {
  ALL_DOWS,
  describeDays,
  MAX_SPAN_DAYS,
  MAX_TRIP_DAYS,
  type SchedulerSettings,
} from "@/lib/scheduler";
import { nameList } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * What the scheduling page searches for, set in one of two shapes of the same
 * controls: a single labelled bar on a wide screen, and a sentence you fill
 * in on a phone ("fra kl. 18:00 i 3 t på alle dage"). Both edit the same
 * settings and show only what applies: time, length and weekdays for one
 * meeting, or number of days and a start day with the Tur / ferie switch on.
 * The name is only for the group to read; the search never looks at it.
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
}: {
  value: number;
  values: number[];
  format: (v: number) => string;
  onChange: (v: number) => void;
  lessLabel: string;
  moreLabel: string;
}) {
  const i = values.indexOf(value);
  const step = (d: number) => {
    const next = values[i + d];
    if (next !== undefined) onChange(next);
  };
  return (
    <div className="flex h-12 items-center rounded-xl border bg-card">
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

/** The Tur / ferie switch. */
function Switch({
  checked,
  onChange,
  label,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={children ? undefined : label}
      onClick={() => onChange(!checked)}
      className="flex min-h-9 items-center gap-2 text-sm font-bold text-foreground"
    >
      {children}
      <span
        className={cn(
          "flex h-[30px] w-[52px] shrink-0 items-center rounded-full p-[3px] transition-colors",
          checked ? "justify-end bg-primary" : "justify-start bg-border",
        )}
      >
        <span className="h-6 w-6 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}

/** A label above its control, as every field in the wide bar has. */
function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

/** "Alle dage" plus the seven weekdays: the one day a trip starts on. */
function StartDayPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (dow: number | null) => void;
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
        className={cn(base, "mr-1.5 px-3", value === null ? on : off)}
      >
        {t.scheduler.anyDay}
      </button>
      {ALL_DOWS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          aria-pressed={value === d}
          className={cn(base, "w-9", value === d ? on : off)}
        >
          {t.weekdaysShort[d].charAt(0)}
        </button>
      ))}
    </div>
  );
}

/** The wide screen version: one labelled line. */
export function SettingsBar({ groupSwitcher, name, onName, settings, onChange }: Props) {
  const t = useT();
  const dayValues = useDayValues(settings);

  return (
    <section className="hidden items-end gap-4 rounded-2xl border bg-card px-5 py-4 shadow-sm xl:flex">
      <Field label={t.scheduler.group}>
        <div className="w-72">{groupSwitcher}</div>
      </Field>

      <label className="flex min-w-[9rem] flex-1 flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {t.scheduler.name}
        </span>
        <input
          type="text"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          onChange={(e) => onName(e.target.value)}
          placeholder={t.scheduler.namePlaceholder}
          className="h-12 w-full rounded-xl border bg-card px-3.5 text-base font-bold text-foreground outline-none transition placeholder:font-medium placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>

      {settings.multiDay ? (
        <>
          <Field label={t.scheduler.tripDays}>
            <Stepper
              value={settings.days}
              values={dayValues}
              format={t.common.days}
              onChange={(days) => onChange({ days })}
              lessLabel={t.scheduler.fewerDays}
              moreLabel={t.scheduler.moreDays}
            />
          </Field>
          <Field label={t.scheduler.tripStarts}>
            <StartDayPicker
              value={settings.startDow}
              onChange={(startDow) => onChange({ startDow })}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label={t.scheduler.startsAt}>
            <Dropdown
              value={settings.anyTime ? ANY_TIME : settings.startHour}
              options={startHourOptions(t)}
              onChange={(value) => pickStartHour(value, onChange)}
              suffix={<ChevronDown className="h-4 w-4 text-muted-foreground" />}
              triggerClassName="inline-flex h-12 items-center gap-2 rounded-xl border bg-card px-3.5 text-base font-bold text-foreground transition hover:bg-secondary"
            />
          </Field>
          <Field label={t.scheduler.duration}>
            <Stepper
              value={settings.durationMinutes}
              values={DURATION_VALUES}
              format={t.common.duration}
              onChange={(durationMinutes) => onChange({ durationMinutes })}
              lessLabel={t.scheduler.shorter}
              moreLabel={t.scheduler.longer}
            />
          </Field>
          <Field label={t.scheduler.dayLabel}>
            <div className="w-64 2xl:w-72">
              <DaySlider
                size="lg"
                selected={settings.dows}
                onChange={(dows) => onChange({ dows })}
              />
            </div>
          </Field>
        </>
      )}

      <div className="w-px self-stretch bg-border" />
      <Field label={t.scheduler.tripToggle}>
        <Switch
          checked={settings.multiDay}
          onChange={(multiDay) => onChange({ multiDay })}
          label={t.scheduler.tripToggleAria}
        />
      </Field>
    </section>
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
          />
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
      </div>
    </section>
  );
}
