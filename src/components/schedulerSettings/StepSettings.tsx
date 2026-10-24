import { ChevronDown } from "lucide-react";

import DaySlider from "@/components/DaySlider";
import Dropdown from "@/components/Dropdown";
import PeriodPicker from "@/components/PeriodPicker";
import { useT } from "@/i18n/lang";
import type { PlanField } from "@/lib/aiPlan";
import {
  DURATION_VALUES,
  MAX_NAME_LENGTH,
  startHourOptions,
  startValue,
  pickStartHour,
  type Props,
  useDayValues,
} from "./options";
import { Stepper, Field, StartDayPicker, KindChoice } from "./parts";

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
                value={startValue(settings)}
                options={startHourOptions(t, settings)}
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
