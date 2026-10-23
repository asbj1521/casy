import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plane } from "lucide-react";

import { LOCALE, useLang, useT } from "@/i18n/lang";
import { buildMonthLayout } from "@/lib/calendarOverview";
import { capitalize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { APP_TIME_ZONE, localDate, startOfDay, startOfMonth } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/**
 * Picking the day a trip ends (or began, #115) on a month like the phone's
 * own date picker: the journey's day is marked, the days that can be picked
 * are the ones not greyed, and a tap shades the stretch away from the journey
 * to the day picked. ‹ › turn the month.
 */
export default function DayPicker({
  allowed,
  journey,
  selected,
  onSelect,
}: {
  /** The days that can be picked, as local midnights. */
  allowed: number[];
  /** The day of the journey Casy knows about (a local midnight). */
  journey: number;
  selected: number | null;
  onSelect: (day: number) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const canPick = useMemo(() => new Set(allowed), [allowed]);
  // The months between the journey and the furthest day that can be picked.
  const bounds = useMemo(() => {
    const days = [journey, ...allowed];
    return {
      first: startOfMonth(Math.min(...days), TZ),
      last: startOfMonth(Math.max(...days), TZ),
    };
  }, [allowed, journey]);
  // Opens on the month of the first day that can be picked.
  const [month, setMonth] = useState(() =>
    startOfMonth(allowed.length > 0 ? allowed[0] : journey, TZ),
  );
  const { year, month: m } = localDate(month, TZ);
  const layout = useMemo(() => buildMonthLayout(year, m, TZ, LOCALE[lang]), [year, m, lang]);
  const name = capitalize(
    new Date(month).toLocaleDateString(LOCALE[lang], {
      month: "long",
      year: "numeric",
      timeZone: TZ,
    }),
  );
  // The stretch away, from the journey to the day picked, either way round.
  const [from, to] =
    selected === null
      ? [journey, journey]
      : [Math.min(journey, selected), Math.max(journey, selected)];

  const turn = (n: number) => setMonth((current) => startOfMonth(current, TZ, n));

  return (
    <div className="rounded-xl border p-2">
      <div className="mb-1 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => turn(-1)}
          disabled={month <= bounds.first}
          aria-label={t.trips.previousMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full text-primary disabled:text-muted-foreground/40"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-[15px] font-semibold text-foreground">{name}</span>
        <button
          type="button"
          onClick={() => turn(1)}
          disabled={month >= bounds.last}
          aria-label={t.trips.nextMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full text-primary disabled:text-muted-foreground/40"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[12px] font-medium text-muted-foreground">
        {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
          <span key={dow} className="py-1">
            {t.weekdaysShort[dow].charAt(0)}
          </span>
        ))}
      </div>
      {layout.weeks.map((week) => (
        <div key={week[0].key} className="grid grid-cols-7">
          {week.map((d) => {
            const day = startOfDay(d.date.getTime(), TZ);
            if (!d.inMonth) return <span key={d.key} className="h-11" />;
            const isJourney = day === journey;
            const picked = day === selected;
            const away = selected !== null && day >= from && day <= to;
            const open = canPick.has(day);
            return (
              <span
                key={d.key}
                className={cn(
                  "flex h-11 items-center justify-center",
                  away && "bg-primary/15",
                  away && day === from && "rounded-l-full",
                  away && day === to && "rounded-r-full",
                )}
              >
                <button
                  type="button"
                  disabled={!open}
                  onClick={() => onSelect(day)}
                  aria-pressed={picked}
                  aria-label={d.date.toLocaleDateString(LOCALE[lang], {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    timeZone: TZ,
                  })}
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-full text-[17px]",
                    picked
                      ? "bg-primary font-semibold text-primary-foreground"
                      : isJourney
                        ? "font-semibold text-primary"
                        : open
                          ? "text-foreground"
                          : "text-muted-foreground/40",
                  )}
                >
                  {d.dayOfMonth}
                  {isJourney && !picked && (
                    <Plane className="absolute bottom-0.5 h-2.5 w-2.5" aria-hidden />
                  )}
                </button>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
