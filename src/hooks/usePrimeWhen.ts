import { useT } from "@/i18n/lang";
import { formatTime } from "@/lib/format";
import { stretchShape, type PrimeDate } from "@/lib/primeDates";
import { APP_TIME_ZONE } from "@/lib/zone";

/** A starred day's free time in words (#171): "18:00 til 22:00", "Hele dagen", "Hele weekenden". */
export function usePrimeWhen(prime: PrimeDate | null): string | null {
  const t = useT();
  if (!prime) return null;
  const time = (ms: number) => formatTime(new Date(ms).toISOString());
  return {
    weekend: () => t.prime.weekend,
    allDay: () => t.prime.allDay,
    from: () => t.prime.from(time(prime.start)),
    between: () => t.prime.until(time(prime.start), time(prime.end)),
  }[stretchShape(prime, APP_TIME_ZONE)]();
}
