import { GuessMark } from "@/components/schedulerSettings/parts";
import { FIELD_LABEL } from "@/components/ui/field";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { capitalize } from "@/lib/format";
import { monthMarks, searchedMonths } from "@/lib/periodMonths";
import { monthName, periodText } from "@/lib/periodText";
import { pickPeriodMonth, type Period } from "@/lib/scheduler";
import { cn } from "@/lib/utils";
import { APP_TIME_ZONE, localDate } from "@/lib/zone";

/**
 * When, in the Planlæg sheet (#173): the twelve months searched, all in view
 * as two rows of six, neither behind a menu nor scrolled sideways. A tap
 * picks a month, a tap on another stretches the period to it, and a tap on
 * either end takes that month off (pickPeriodMonth, as the month grid).
 * Beside the label, "Når som helst" as plain text: lit while it holds, with
 * every month lit too since all are searched, grey once months are picked,
 * and a tap clears them. Exact days set by Casy's AI (#134) shade the months
 * they touch, and the line under says which.
 */
export default function PlanMonths({
  value,
  onChange,
  mark,
}: {
  value: Period | null;
  onChange: (period: Period | null) => void;
  /** "gættet" after the label, for a period Casy's AI guessed. */
  mark?: string | null;
}) {
  const t = useT();
  const { lang } = useLang();
  const months = searchedMonths();
  const { inPeriod, isEnd } = monthMarks(value);

  return (
    <section className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <span className={cn(FIELD_LABEL, "flex items-center gap-1.5")}>
          {t.planFromCalendar.months}
          {mark && <GuessMark mark={mark} />}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={value === null}
          className={cn(
            "mb-1.5 px-1 text-[13px] font-semibold transition-colors",
            value === null ? "text-primary" : "text-muted-foreground",
          )}
        >
          {t.scheduler.period.anyButton}
        </button>
      </div>
      <div
        role="group"
        aria-label={t.planFromCalendar.months}
        className="grid grid-cols-6 gap-1.5 rounded-2xl border bg-card p-1.5"
      >
        {months.map((m, i) => {
          const { month, year } = localDate(Date.parse(m), APP_TIME_ZONE);
          const end = isEnd(m);
          // Når som helst lights every month: all of them are searched.
          const on = value === null || inPeriod(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => onChange(pickPeriodMonth(value, m, APP_TIME_ZONE))}
              aria-pressed={on}
              aria-label={`${capitalize(monthName(m, LOCALE[lang], "long"))} ${year}`}
              className={cn(
                "flex h-11 flex-col items-center justify-center rounded-xl text-[15px] font-semibold leading-tight transition",
                end
                  ? "bg-cta text-white"
                  : on
                    ? "bg-primary/15 text-foreground"
                    : "text-foreground active:bg-secondary",
              )}
            >
              {capitalize(monthName(m, LOCALE[lang], "short").replace(".", ""))}
              {/* The year where it changes, so January reads as next year's. */}
              {month === 0 && i > 0 && (
                <span className="text-[10px] font-medium opacity-70">{year}</span>
              )}
            </button>
          );
        })}
      </div>
      {value && (
        <p className="mt-1.5 px-1 text-xs text-muted-foreground">
          {value.days
            ? t.scheduler.period.daysHint(periodText(value, LOCALE[lang], t))
            : t.scheduler.period.hint}
        </p>
      )}
    </section>
  );
}
