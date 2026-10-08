import { useLang, useT } from "@/i18n/lang";
import {
  formatDuration,
  formatSegmentRange,
  holidayName,
  type DaySegment,
  type OverviewCalendar,
} from "@/lib/calendarOverview";
import { APP_TIME_ZONE } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/**
 * One row in the selected day's list. Holidays and busy blocks differ only in
 * what the two lines of text say and which pill sits on the right, so they
 * share the row rather than duplicating its frame.
 */
export function DayRow({
  seg,
  calendar,
  rgb,
}: {
  seg: DaySegment;
  calendar: OverviewCalendar | undefined;
  rgb: string;
}) {
  const t = useT();
  const { lang } = useLang();
  const holiday = seg.holiday;
  const words = t.calendarView;

  // A holiday shows its name in the page's language, with the other
  // language's name beside it.
  const title = holiday ? holidayName(holiday, lang) : formatSegmentRange(seg, TZ, words.allDay);
  const aside = holiday
    ? holidayName(holiday, lang === "da" ? "en" : "da")
    : seg.allDay
      ? ""
      : formatDuration(seg.start, seg.end, words.hourUnit);
  const source = holiday
    ? `${holiday.kind === "public" ? words.publicHoliday : words.observedDay} · ${words.denmark}`
    : [
        calendar?.name ?? words.calendarFallback,
        calendar?.account,
        calendar && words.providerNames[calendar.provider],
      ]
        .filter(Boolean)
        .join(" · ");
  const pill = holiday
    ? words.holidayCategory
    : calendar?.purpose
      ? t.categories[calendar.purpose]
      : words.noCategory;

  return (
    <li className="flex items-start gap-3 py-3 text-sm">
      <span
        className="mt-0.5 h-8 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: `rgb(${rgb})` }}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">
          {title}
          {aside && <span className="ml-2 font-normal text-muted-foreground">{aside}</span>}
        </p>
        <p className="text-muted-foreground">{source}</p>
        {!holiday && (seg.continuesBefore || seg.continuesAfter) && (
          <p className="text-xs text-muted-foreground">
            {seg.continuesBefore && seg.continuesAfter
              ? words.continuesBoth
              : seg.continuesBefore
                ? words.continuesBefore
                : words.continuesAfter}
          </p>
        )}
      </div>
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-xs"
        style={{ backgroundColor: `rgba(${rgb}, 0.16)`, color: `rgb(${rgb})` }}
      >
        {pill}
      </span>
    </li>
  );
}
