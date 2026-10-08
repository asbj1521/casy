import { useState, type ReactNode } from "react";

import Popover from "@/components/Popover";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { capitalize } from "@/lib/format";
import type { Period } from "@/lib/scheduler";
import { cn } from "@/lib/utils";
import { APP_TIME_ZONE, localDate, startOfMonth } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/** The months the search covers, this one first, as local midnights of their 1st. */
function searchedMonths(): string[] {
  const first = startOfMonth(Date.now(), TZ);
  return Array.from({ length: 12 }, (_, i) => new Date(startOfMonth(first, TZ, i)).toISOString());
}

function monthName(iso: string, locale: string, month: "long" | "short"): string {
  return new Date(iso).toLocaleDateString(locale, { month, timeZone: TZ });
}

/**
 * When the event should happen (#74): any time, one month ("i december"), or
 * a run of months ("nov. til jan."). A chip that opens the twelve months
 * searched: a tap picks a month, a tap on a later one stretches it into a
 * period, and the next tap starts again. Shared by the scheduling page's
 * wide bar and its phone sentence, which style the chip their own way.
 */
export default function PeriodPicker({
  value,
  onChange,
  triggerClassName,
  suffix,
  capitalized = false,
  className = "inline-block",
}: {
  /** The wrapper's layout: inline by default, `block` to fill a row. */
  className?: string;
  value: Period | null;
  onChange: (period: Period | null) => void;
  triggerClassName: string;
  suffix: ReactNode;
  /** Start with a capital, for a chip on its own rather than inside a sentence. */
  capitalized?: boolean;
}) {
  const t = useT();
  const { lang } = useLang();
  const locale = LOCALE[lang];
  const text = !value
    ? t.scheduler.period.any
    : value.from === value.to
      ? t.scheduler.period.one(monthName(value.from, locale, "long"))
      : t.scheduler.period.range(
          monthName(value.from, locale, "short"),
          monthName(value.to, locale, "short"),
        );
  const label = capitalized ? capitalize(text) : text;

  return (
    <Popover
      className={className}
      triggerClassName={triggerClassName}
      panelClassName="w-72 p-3"
      trigger={() => (
        <>
          {label}
          {suffix}
        </>
      )}
    >
      {(close) => <MonthGrid value={value} onChange={onChange} onDone={close} />}
    </Popover>
  );
}

function MonthGrid({
  value,
  onChange,
  onDone,
}: {
  value: Period | null;
  onChange: (period: Period | null) => void;
  onDone: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const months = searchedMonths();
  // The month a period is being stretched from, after a first tap.
  const [anchor, setAnchor] = useState<string | null>(null);

  function pick(month: string) {
    if (anchor && Date.parse(month) >= Date.parse(anchor)) {
      onChange({ from: anchor, to: month });
      setAnchor(null);
    } else {
      onChange({ from: month, to: month });
      setAnchor(month);
    }
  }

  const inPeriod = (m: string) =>
    !!value && Date.parse(m) >= Date.parse(value.from) && Date.parse(m) <= Date.parse(value.to);
  const isEnd = (m: string) => !!value && (m === value.from || m === value.to);

  return (
    <div>
      <p className="px-1 text-sm text-muted-foreground">{t.scheduler.period.hint}</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {months.map((m, i) => {
          const { month } = localDate(Date.parse(m), TZ);
          // The year where it changes, so "jan." reads as next year's.
          const showYear = i === 0 || month === 0;
          return (
            <button
              key={m}
              type="button"
              onClick={() => pick(m)}
              aria-pressed={inPeriod(m)}
              className={cn(
                "flex h-12 flex-col items-center justify-center rounded-lg text-sm font-bold capitalize transition",
                isEnd(m)
                  ? "bg-primary text-primary-foreground"
                  : inPeriod(m)
                    ? "bg-primary/15 text-foreground"
                    : "border bg-card text-foreground hover:bg-secondary",
              )}
            >
              {monthName(m, LOCALE[lang], "short").replace(".", "")}
              {showYear && (
                <span className="text-[10px] font-medium opacity-70">
                  {localDate(Date.parse(m), TZ).year}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setAnchor(null);
          }}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          {t.scheduler.period.anyButton}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          {t.scheduler.period.done}
        </button>
      </div>
    </div>
  );
}
