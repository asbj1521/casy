import { Link } from "react-router-dom";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

import DaySlider from "@/components/DaySlider";
import Dropdown from "@/components/Dropdown";
import PeriodPicker from "@/components/PeriodPicker";
import Popover from "@/components/Popover";
import Switch from "@/components/ui/Switch";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { ALL_DOWS, describeDays } from "@/lib/scheduler";
import { nameList } from "@/lib/format";
import {
  DURATION_VALUES,
  MAX_NAME_LENGTH,
  ANY_DAY,
  startHourOptions,
  startValue,
  pickStartHour,
  type Props,
  weekdayLong,
  useDayValues,
} from "./options";

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
            {!settings.anyTime && !settings.startWindow && <span>{t.scheduler.sentenceAt}</span>}
            <Dropdown
              value={startValue(settings)}
              options={startHourOptions(t, settings)}
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
