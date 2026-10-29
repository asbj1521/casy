import { useMemo, useState } from "react";
import { CalendarDays, Clock, Flag, Diff } from "lucide-react";

import DaySlider from "@/components/DaySlider";
import { KindChoice, Stepper } from "@/components/schedulerSettings/parts";
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
import { capitalize, formatClockMinutes } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { ALL_DOWS, describeDays, type SchedulerSettings } from "@/lib/scheduler";
import { FLEX_MINUTES, flexOf, flexWindow } from "@/lib/startFlex";
import { cn } from "@/lib/utils";

import { litClass, litRing, type FillKey } from "./fill";
import type { FillPress, FillSheet } from "./useAiFill";

const DAY_MINUTES = 24 * 60;
/** The day sheet's quick picks, as describeDays names them. */
const DAY_PRESETS = [
  { kind: "all", dows: [...ALL_DOWS] },
  { kind: "weekdays", dows: [1, 2, 3, 4, 5] },
  { kind: "weekends", dows: [6, 0] },
] as const;

/** Fredag og lørdag: the evenings most often planned for, a quick pick of their own. */
const FRI_SAT = [5, 6];

type Open = "time" | "days" | "startDay" | null;

/**
 * The Planlæg sheet's time (#173): Møde or Tur / ferie, then one row per
 * setting with its value on the right, each opening a small sheet of its
 * own. A meeting is "17:00 - 19:00" (one sheet, two wheels), give or take
 * (Fleksibel, stepped by half hours in its row: the whole meeting may move,
 * stored as a start window around the hour, see lib/startFlex), on some
 * weekdays (quick picks, or the seven in a row). With no set start (Når som
 * helst, or a window Casy's AI chose) the second wheel is its length.
 */
export default function TimeRows({
  settings,
  onChange,
  lit = null,
  drive = null,
}: {
  settings: SchedulerSettings;
  onChange: (patch: Partial<SchedulerSettings>) => void;
  /** The row Casy is filling in right now (#173), lit up. */
  lit?: FillKey | null;
  /** While Casy fills the sheet in: the row's sheet it has open, the button it presses. */
  drive?: { sheet: FillSheet | null; press: FillPress | null } | null;
}) {
  const t = useT();
  const { lang } = useLang();
  const words = t.planFromCalendar;
  const [own, setOpen] = useState<Open>(null);
  // Casy's hand opens and closes them while it fills the sheet in.
  const open: Open = drive ? drive.sheet : own;
  const close = () => setOpen(null);
  const pressed = (less: FillPress, more: FillPress) =>
    drive?.press === less ? "less" : drive?.press === more ? "more" : null;
  const dayValues = useDayValues(settings);

  const flex = flexOf(settings);
  const fixedStart = !settings.anyTime && flex !== null;
  // A window made by Fleksibel is the hour itself on the wheel and the row;
  // only one Casy's AI chose is listed as its own ("Mellem 18:00 og 21:00").
  const wheel = flex === null ? settings : { ...settings, startWindow: null };
  // The same lists from one render to the next, or a wheel would snap back
  // to its value each time rather than roll there.
  const windowFrom = wheel.startWindow?.from ?? null;
  const windowTo = wheel.startWindow?.to ?? null;
  const startOptions = useMemo(
    () =>
      startHourOptions(t, {
        startWindow:
          windowFrom === null || windowTo === null ? null : { from: windowFrom, to: windowTo },
      }),
    [t, windowFrom, windowTo],
  );
  const endOptions = useMemo(
    () =>
      DURATION_VALUES.map((d) => ({
        label: fixedStart
          ? formatClockMinutes((settings.startHour * 60 + d) % DAY_MINUTES)
          : t.common.duration(d),
        value: d,
      })),
    [t, fixedStart, settings.startHour],
  );
  const startLabel = startOptions.find((o) => o.value === startValue(wheel))?.label;
  const clock = (minutes: number) => formatClockMinutes(minutes % DAY_MINUTES);
  const days = describeDays(settings.dows);
  const friSat = days.kind === "list" && days.dows.join() === FRI_SAT.join();
  const daysLabel = friSat
    ? words.friSat
    : days.kind === "list"
      ? days.dows.map((d) => t.weekdaysShort[d]).join(", ")
      : capitalize(t.scheduler.dayList[days.kind]);
  const presets = [
    ...DAY_PRESETS.map((p) => ({
      key: p.kind,
      dows: p.dows,
      label: capitalize(t.scheduler.dayList[p.kind]),
      on: days.kind === p.kind,
    })),
    {
      key: "friSat",
      dows: FRI_SAT,
      label: words.friSat,
      on: friSat,
    },
  ];

  // A new hour keeps the flexibility; any other pick is pickStartHour's.
  const pickStart = (value: number) =>
    pickStartHour(value, (patch) =>
      onChange(
        patch.startHour === undefined
          ? patch
          : { ...patch, startWindow: flexWindow(patch.startHour, flex ?? 0) },
      ),
    );

  return (
    <section className="mt-4">
      <div className={cn("rounded-xl", litRing(lit, "kind"))}>
        <KindChoice
          fill
          multiDay={settings.multiDay}
          onChange={(multiDay) => onChange({ multiDay })}
        />
      </div>

      {settings.multiDay ? (
        <ListGroup className="mt-3">
          <ListRow
            className={litClass(lit, "tripDays")}
            icon={CalendarDays}
            label={t.scheduler.tripDays}
            trailing={
              <Stepper
                inRow
                pressed={pressed("tripLess", "tripMore")}
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
            className={litClass(lit, "startDay")}
            icon={Flag}
            label={t.scheduler.tripStarts}
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
            className={litClass(lit, "time")}
            icon={Clock}
            label={t.settingsPanel.tabs.time}
            value={
              fixedStart
                ? words.fromTo(
                    clock(settings.startHour * 60),
                    clock(settings.startHour * 60 + settings.durationMinutes),
                  )
                : `${startLabel}, ${t.common.duration(settings.durationMinutes)}`
            }
            chevron
            onClick={() => setOpen("time")}
          />
          {fixedStart && (
            <ListRow
              className={litClass(lit, "flex")}
              icon={Diff}
              label={words.flex}
              trailing={
                <Stepper
                  inRow
                  pressed={pressed("flexLess", "flexMore")}
                  value={flex}
                  values={[...FLEX_MINUTES]}
                  format={(f) => t.common.duration(f)}
                  onChange={(f) => onChange({ startWindow: flexWindow(settings.startHour, f) })}
                  lessLabel={words.flexLess}
                  moreLabel={words.flexMore}
                />
              }
            />
          )}
          <ListRow
            className={litClass(lit, "days")}
            icon={CalendarDays}
            label={t.scheduler.dayLabel}
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
            <WheelPicker
              driven={!!drive}
              options={startOptions}
              value={startValue(wheel)}
              onChange={pickStart}
            />
          </div>
          <div>
            <p className={cn(FIELD_LABEL, "text-center")}>
              {fixedStart ? words.to : t.scheduler.duration}
            </p>
            <WheelPicker
              driven={!!drive}
              options={endOptions}
              value={settings.durationMinutes}
              onChange={(durationMinutes) => onChange({ durationMinutes })}
            />
          </div>
        </div>
      </BottomSheet>
      <BottomSheet
        open={open === "days"}
        onClose={close}
        title={t.scheduler.dayLabel}
        doneLabel={t.schedulerFlow.done}
      >
        <ListGroup className="mt-0">
          {presets.map((p) => (
            <ListPickRow
              key={p.key}
              type="radio"
              name="day-preset"
              checked={p.on}
              onChange={() => {
                haptic("select");
                onChange({ dows: [...p.dows] });
              }}
              label={p.label}
            />
          ))}
        </ListGroup>
        {/* Or day by day, the seven in one row. */}
        <div className="mt-4">
          <DaySlider size="lg" selected={settings.dows} onChange={(dows) => onChange({ dows })} />
        </div>
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
                haptic("select");
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
