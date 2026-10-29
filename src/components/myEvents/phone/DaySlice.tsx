import { useMemo } from "react";

import DayColumns from "@/components/swipe/DayColumns";
import { useMyCalendarDays } from "@/hooks/useMyCalendarDays";
import { useT } from "@/i18n/lang";
import { addDays, APP_TIME_ZONE, startOfDay } from "@/lib/zone";

const TZ = APP_TIME_ZONE;
/** The fewest hours the slice shows, and the room kept either side of the event. */
const LEAST_HOURS = 5;
const AROUND_HOURS = 1;

/**
 * An agreed event's day in your own calendar (#177): a slice of the day view
 * (DayColumns, one day, opened on the event, its hours squeezed so the whole
 * event fits with an hour either side, five hours at the least), the
 * event drawn solid in Casy's orange among your own blocks, so whether it
 * fits is seen rather than said. A tap opens that day in the day view.
 */
export default function DaySlice({
  start,
  end,
  label,
  onOpen,
}: {
  start: number;
  end: number;
  label: string;
  onOpen: (day: number) => void;
}) {
  const t = useT();
  const calendar = useMyCalendarDays();
  const day = startOfDay(start, TZ);
  // Its part of this day (a trip runs on past midnight), in hours.
  const onDay = (Math.min(end, addDays(day, 1, TZ)) - start) / 3_600_000;
  const hours = Math.min(24, Math.max(LEAST_HOURS, onDay + 2 * AROUND_HOURS));
  const aim = useMemo(() => ({ start, end }), [start, end]);
  const pencils = useMemo(
    () => [{ key: "event", start, end, label, lit: true }],
    [start, end, label],
  );
  if (calendar.none) return null;
  return (
    <button
      type="button"
      onClick={() => onOpen(day)}
      aria-label={t.events.openDay}
      className="block h-[260px] w-full overflow-hidden rounded-2xl border bg-card text-left transition active:scale-[0.99]"
    >
      <div aria-hidden className="pointer-events-none h-full" inert>
        <DayColumns
          home={day}
          days={1}
          lead="first"
          aim={aim}
          pencils={pencils}
          calendar={calendar}
          size="full"
          fitHours={hours}
          tone="orange"
        />
      </div>
    </button>
  );
}
