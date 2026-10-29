import { useState, type ReactNode } from "react";
import { CalendarDays, Clock, Flag, MoveHorizontal } from "lucide-react";

import { GuessMark, KindChoice, Stepper } from "@/components/schedulerSettings/parts";
import {
  DURATION_VALUES,
  pickStartHour,
  startHourOptions,
  startValue,
  useDayValues,
  weekdayLong,
} from "@/components/schedulerSettings/options";
import BottomSheet from "@/components/ui/BottomSheet";
import { FIELD_LABEL } from "@/components/ui/field";
import { ListGroup, ListPickRow, ListRow } from "@/components/ui/ListGroup";
import WheelPicker from "@/components/WheelPicker";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import type { PlanField } from "@/lib/aiPlan";
import { capitalize, formatClockMinutes } from "@/lib/format";
import { ALL_DOWS, describeDays, type SchedulerSettings } from "@/lib/scheduler";
import { FLEX_MINUTES, flexOf, flexWindow } from "@/lib/startFlex";
import { cn } from "@/lib/utils";

const DAY_MINUTES = 24 * 60;
/** The day sheet's quick picks, as describeDays names them. */
const DAY_PRESETS = [
  { kind: "all", dows: [...ALL_DOWS] },
  { kind: "weekdays", dows: [1, 2, 3, 4, 5] },
  { kind: "weekends", dows: [6, 0] },
] as const;

type Open = "time" | "flex" | "days" | "startDay" | null;

/**
 * The Planlæg sheet's time (#173): Møde or Tur / ferie, then one row per
 * setting with its value on the right, each opening a small sheet of its
 * own. A meeting is "17:00 til 19:00" (one sheet, two wheels), give or take
 * (Fleksibel: the whole meeting may move, stored as a start window around
 * the hour, see lib/startFlex), on some weekdays. With no set start (Når som
 * helst, or a window Casy's AI chose) the second wheel is its length.
 */
export default function TimeRows({
  settings,
  onChange,
  guessed,
}: {
  settings: SchedulerSettings;
  onChange: (patch: Partial<SchedulerSettings>) => void;
  guessed: readonly PlanField[];
}) {
  const t = useT();
  const { lang } = useLang();
  const words = t.planFromCalendar;
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);
  const label = (text: string, field: PlanField | PlanField[]): ReactNode =>
    [field].flat().some((f) => guessed.includes(f)) ? (
      <span className="flex items-center gap-1.5">
        {text}
        <GuessMark mark={t.aiPlan.guessed} />
      </span>
    ) : (
      text
    );
  const dayValues = useDayValues(settings);

  const guessedTime: PlanField[] = ["startHour", "durationMinutes"];
  const flex = flexOf(settings);
  const fixedStart = !settings.anyTime && flex !== null;
  const startOptions = startHourOptions(t, settings);
  const startLabel = startOptions.find((o) => o.value === startValue(settings))?.label;
  const clock = (minutes: number) => formatClockMinutes(minutes % DAY_MINUTES);
  const flexLabel = (f: number) => (f === 0 ? words.exact : `± ${t.common.duration(f)}`);
  const days = describeDays(settings.dows);
  const daysLabel =
    days.kind === "list"
      ? days.dows.map((d) => t.weekdaysShort[d]).join(", ")
      : capitalize(t.scheduler.dayList[days.kind]);

  // A new hour keeps the flexibility; any other pick is pickStartHour's.
  const pickStart = (value: number) =>
    pickStartHour(value, (patch) =>
      onChange(
        patch.startHour === undefined
          ? patch
          : { ...patch, startWindow: flexWindow(patch.startHour, flex ?? 0) },
      ),
    );
  const toggleDay = (d: number) => {
    const on = settings.dows.includes(d);
    if (on && settings.dows.length <= 1) return; // at least one day stays on
    onChange({ dows: on ? settings.dows.filter((x) => x !== d) : [...settings.dows, d] });
  };

  return (
    <section className="mt-4">
      <KindChoice
        fill
        multiDay={settings.multiDay}
        onChange={(multiDay) => onChange({ multiDay })}
      />
      {guessed.includes("kind") && (
        <p className="mt-1.5 px-1">
          <GuessMark mark={t.aiPlan.guessed} />
        </p>
      )}

      {settings.multiDay ? (
        <ListGroup className="mt-3">
          <ListRow
            icon={CalendarDays}
            label={label(t.scheduler.tripDays, "days")}
            trailing={
              <Stepper
                inRow
                value={settings.days}
                values={dayValues}
                format={t.common.days}
                onChange={(days) => onChange({ days })}
                lessLabel={t.scheduler.fewerDays}
                moreLabel={t.scheduler.moreDays}
              />
            }
          />
          <ListRow
            icon={Flag}
            label={label(t.scheduler.tripStarts, "startWeekday")}
            value={
              settings.startDow === null
                ? t.scheduler.anyDay
                : capitalize(weekdayLong(settings.startDow, LOCALE[lang]))
            }
            chevron
            onClick={() => setOpen("startDay")}
          />
        </ListGroup>
      ) : (
        <ListGroup className="mt-3">
          <ListRow
            icon={Clock}
            label={label(t.settingsPanel.tabs.time, guessedTime)}
            value={
              fixedStart
                ? words.fromTo(
                    startLabel ?? "",
                    clock(settings.startHour * 60 + settings.durationMinutes),
                  )
                : `${startLabel}, ${t.common.duration(settings.durationMinutes)}`
            }
            chevron
            onClick={() => setOpen("time")}
          />
          {fixedStart && (
            <ListRow
              icon={MoveHorizontal}
              label={words.flex}
              detail={
                settings.startWindow
                  ? words.canStart(
                      formatClockMinutes(settings.startWindow.from),
                      formatClockMinutes(settings.startWindow.to),
                    )
                  : undefined
              }
              value={flexLabel(flex)}
              chevron
              onClick={() => setOpen("flex")}
            />
          )}
          <ListRow
            icon={CalendarDays}
            label={label(t.scheduler.dayLabel, "weekdays")}
            value={daysLabel}
            chevron
            onClick={() => setOpen("days")}
          />
        </ListGroup>
      )}

      <BottomSheet
        open={open === "time"}
        onClose={close}
        title={t.settingsPanel.tabs.time}
        doneLabel={t.schedulerFlow.done}
      >
        {/* Start and end side by side; the end keeps its distance as the start moves. */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className={cn(FIELD_LABEL, "text-center")}>{words.from}</p>
            <WheelPicker options={startOptions} value={startValue(settings)} onChange={pickStart} />
          </div>
          <div>
            <p className={cn(FIELD_LABEL, "text-center")}>
              {fixedStart ? words.to : t.scheduler.duration}
            </p>
            <WheelPicker
              options={DURATION_VALUES.map((d) => ({
                label: fixedStart ? clock(settings.startHour * 60 + d) : t.common.duration(d),
                value: d,
              }))}
              value={settings.durationMinutes}
              onChange={(durationMinutes) => onChange({ durationMinutes })}
            />
          </div>
        </div>
      </BottomSheet>
      <BottomSheet
        open={open === "flex"}
        onClose={close}
        title={words.flex}
        doneLabel={t.schedulerFlow.done}
      >
        <ListGroup className="mt-0">
          {FLEX_MINUTES.map((f) => {
            const window = flexWindow(settings.startHour, f);
            return (
              <ListPickRow
                key={f}
                type="radio"
                name="flex"
                checked={flex === f}
                onChange={() => {
                  onChange({ startWindow: window });
                  close();
                }}
                label={flexLabel(f)}
                detail={
                  window
                    ? words.canStart(formatClockMinutes(window.from), formatClockMinutes(window.to))
                    : undefined
                }
              />
            );
          })}
        </ListGroup>
      </BottomSheet>
      <BottomSheet
        open={open === "days"}
        onClose={close}
        title={t.scheduler.dayLabel}
        doneLabel={t.schedulerFlow.done}
      >
        <ListGroup className="mt-0">
          {DAY_PRESETS.map((p) => (
            <ListPickRow
              key={p.kind}
              type="radio"
              name="day-preset"
              checked={days.kind === p.kind}
              onChange={() => onChange({ dows: [...p.dows] })}
              label={capitalize(t.scheduler.dayList[p.kind])}
            />
          ))}
        </ListGroup>
        <ListGroup>
          {ALL_DOWS.map((d) => (
            <ListPickRow
              key={d}
              type="checkbox"
              checked={settings.dows.includes(d)}
              onChange={() => toggleDay(d)}
              label={capitalize(weekdayLong(d, LOCALE[lang]))}
            />
          ))}
        </ListGroup>
      </BottomSheet>
      <BottomSheet
        open={open === "startDay"}
        onClose={close}
        title={t.scheduler.tripStarts}
        doneLabel={t.schedulerFlow.done}
      >
        <ListGroup className="mt-0">
          {[null, ...ALL_DOWS].map((d) => (
            <ListPickRow
              key={String(d)}
              type="radio"
              name="start-day"
              checked={settings.startDow === d}
              onChange={() => {
                onChange({ startDow: d });
                close();
              }}
              label={d === null ? t.scheduler.anyDay : capitalize(weekdayLong(d, LOCALE[lang]))}
            />
          ))}
        </ListGroup>
      </BottomSheet>
    </section>
  );
}
