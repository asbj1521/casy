import { MapPin } from "lucide-react";

import { useLang, useT } from "@/i18n/lang";
import {
  formatDuration,
  formatSegmentRange,
  holidayName,
  type DaySegment,
  type OverviewCalendar,
} from "@/lib/calendarOverview";
import { useIsDark } from "@/hooks/useIsDark";
import { shade } from "@/lib/tint";
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
  const dark = useIsDark();
  const t = useT();
  const { lang } = useLang();
  const holiday = seg.holiday;
  const words = t.calendarView;
  // An event this phone read itself (the iPhone app, #110): named by its own
  // title, with the time and calendar under it, then its place and notes.
  const details = holiday ? undefined : seg.details;
  const range = formatSegmentRange(seg, TZ, words.allDay);
  const duration = seg.allDay ? "" : formatDuration(seg.start, seg.end, words.hourUnit);

  // A holiday shows its name in the page's language, with the other
  // language's name beside it.
  const title = holiday
    ? holidayName(holiday, lang)
    : details
      ? details.title || (calendar?.name ?? words.calendarFallback)
      : range;
  const aside = holiday
    ? holidayName(holiday, lang === "da" ? "en" : "da")
    : details
      ? ""
      : duration;
  const source = holiday
    ? `${holiday.kind === "public" ? words.publicHoliday : words.observedDay} · ${words.denmark}`
    : details
      ? [[range, duration].filter(Boolean).join(" "), calendar?.name].filter(Boolean).join(" · ")
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
        {details?.location && (
          <p className="mt-0.5 flex items-start gap-1 text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">{details.location}</span>
          </p>
        )}
        {details?.notes && (
          <p className="mt-1 line-clamp-4 whitespace-pre-line break-words text-xs text-muted-foreground">
            {details.notes}
          </p>
        )}
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
        style={{
          backgroundColor: `rgba(${rgb}, 0.16)`,
          color: `rgb(${dark ? shade(rgb, true) : rgb})`,
        }}
      >
        {pill}
      </span>
    </li>
  );
}
