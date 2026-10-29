import type { Period } from "@/lib/scheduler";
import { APP_TIME_ZONE, startOfMonth } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/** The months the search covers, this one first, as local midnights of their 1st. */
export function searchedMonths(): string[] {
  const first = startOfMonth(Date.now(), TZ);
  return Array.from({ length: 12 }, (_, i) => new Date(startOfMonth(first, TZ, i)).toISOString());
}

/**
 * How a month (its 1st's local midnight) stands in a period: inside it, and
 * one of its ends. Exact days (#134) shade every month they touch, with no
 * ends to tap off: a tap on any month replaces them (pickPeriodMonth).
 */
export function monthMarks(value: Period | null) {
  const inPeriod = (m: string) =>
    !!value &&
    (value.days
      ? startOfMonth(Date.parse(value.from), TZ) <= Date.parse(m) &&
        Date.parse(m) <= Date.parse(value.to)
      : Date.parse(m) >= Date.parse(value.from) && Date.parse(m) <= Date.parse(value.to));
  const isEnd = (m: string) => !!value && !value.days && (m === value.from || m === value.to);
  return { inPeriod, isEnd };
}
