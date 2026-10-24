/** The scheduler settings' shared pickers and helpers (#160), used by all three layouts. */
import { type ReactNode } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";

import DaySlider from "@/components/DaySlider";
import Dropdown from "@/components/Dropdown";
import PeriodPicker from "@/components/PeriodPicker";
import { useT } from "@/i18n/lang";
import { ALL_DOWS } from "@/lib/scheduler";
import type { PlanField } from "@/lib/aiPlan";
import { cn } from "@/lib/utils";
import {
  DURATION_VALUES,
  startHourOptions,
  startValue,
  pickStartHour,
  type Props,
  useDayValues,
} from "./options";

/** A value you step through with minus and plus, never opening a menu. */
export function Stepper({
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
export function Field({
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
export function StartDayPicker({
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

/** Meeting or Tur / ferie, as two halves of one control. */
export function KindChoice({
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
export function TimeSettings({
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
                value={startValue(settings)}
                options={startHourOptions(t, settings)}
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
