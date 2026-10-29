import { useMemo } from "react";

import DayColumns from "@/components/swipe/DayColumns";
import { useMyCalendarDays } from "@/hooks/useMyCalendarDays";
import { useT } from "@/i18n/lang";
import { APP_TIME_ZONE, startOfDay } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/**
 * An agreed event's day in your own calendar (#177): a slice of the day view
 * (DayColumns, one day, about five hours tall, opened on the event), the
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
          tone="orange"
        />
      </div>
    </button>
  );
}
