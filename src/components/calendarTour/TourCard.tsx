import { useT } from "@/i18n/lang";
import type { OverviewCalendar } from "@/lib/calendarOverview";
import { textOn } from "@/lib/calendarTour";

/** A calendar as the big card (#221): filled with its own colour, its name big, so you know which it is. */
export default function TourCard({
  calendar,
  color,
}: {
  calendar: OverviewCalendar;
  /** "r, g, b". */
  color: string;
}) {
  const words = useT().calendarTour;
  const text = textOn(color);
  const detail = [calendar.account, words.events(calendar.total)].filter(Boolean).join(" · ");
  return (
    <div
      className="flex h-full flex-col justify-end overflow-hidden rounded-3xl px-5 py-3.5 shadow-lg shadow-black/15"
      style={{ backgroundColor: `rgb(${color})`, color: text }}
    >
      <p className="line-clamp-2 text-[1.625rem] font-extrabold leading-[1.1] tracking-tight">
        {calendar.name}
      </p>
      <p className="mt-1 truncate text-[0.8125rem] font-medium opacity-90 short:hidden large-text:hidden">
        {detail}
      </p>
    </div>
  );
}
