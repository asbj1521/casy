/**
 * A scheduling period (#74) in words, as the month picker's chip says it and
 * the AI's summary (#100) repeats it: "når som helst", "i december", "nov. til
 * jan.". Months are named in Danish time, like every date Casy shows.
 */
import type { Messages } from "@/i18n/da";
import type { Period } from "@/lib/scheduler";
import { APP_TIME_ZONE } from "@/lib/zone";

/** A month's name ("december" or "dec."), from the local midnight of its 1st. */
export function monthName(iso: string, locale: string, month: "long" | "short"): string {
  return new Date(iso).toLocaleDateString(locale, { month, timeZone: APP_TIME_ZONE });
}

export function periodText(value: Period | null, locale: string, t: Messages): string {
  return !value
    ? t.scheduler.period.any
    : value.from === value.to
      ? t.scheduler.period.one(monthName(value.from, locale, "long"))
      : t.scheduler.period.range(
          monthName(value.from, locale, "short"),
          monthName(value.to, locale, "short"),
        );
}
