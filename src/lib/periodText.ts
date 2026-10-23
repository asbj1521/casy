/**
 * A scheduling period (#74) in words, as the month picker's chip says it and
 * the AI's summary (#100) repeats it: "når som helst", "i december", "nov. til
 * jan.". Months are named in Danish time, like every date Casy shows.
 */
import type { Messages } from "@/i18n/da";
import type { Period } from "@/lib/scheduler";
import { APP_TIME_ZONE, startOfDay } from "@/lib/zone";

/** A month's name ("december" or "dec."), from the local midnight of its 1st. */
export function monthName(iso: string, locale: string, month: "long" | "short"): string {
  return new Date(iso).toLocaleDateString(locale, { month, timeZone: APP_TIME_ZONE });
}

/** A day's date ("5. november", "5. nov."), from its local midnight. */
function dayName(iso: string, locale: string, month: "long" | "short"): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month,
    timeZone: APP_TIME_ZONE,
  });
}

/**
 * Exact days (#134): "til 5. november" when they start today or earlier (the
 * AI's "before 5 November"), "den 5. november" for one day, else "12. okt.
 * til 5. nov.".
 */
function daysText(value: Period, locale: string, t: Messages, now: number): string {
  if (value.from === value.to) return t.scheduler.period.day(dayName(value.to, locale, "long"));
  if (Date.parse(value.from) <= startOfDay(now, APP_TIME_ZONE)) {
    return t.scheduler.period.until(dayName(value.to, locale, "long"));
  }
  return t.scheduler.period.range(
    dayName(value.from, locale, "short"),
    dayName(value.to, locale, "short"),
  );
}

export function periodText(
  value: Period | null,
  locale: string,
  t: Messages,
  now = Date.now(),
): string {
  if (value?.days) return daysText(value, locale, t, now);
  return !value
    ? t.scheduler.period.any
    : value.from === value.to
      ? t.scheduler.period.one(monthName(value.from, locale, "long"))
      : t.scheduler.period.range(
          monthName(value.from, locale, "short"),
          monthName(value.to, locale, "short"),
        );
}
