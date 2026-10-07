import { useState } from "react";
import { CalendarClock, Clock } from "lucide-react";

import DateConflicts from "@/components/myEvents/DateConflicts";
import {
  EdgeWarnings,
  ExitConfirm,
  ExitLink,
  GroupName,
  People,
} from "@/components/myEvents/parts";
import YourTime from "@/components/time/YourTime";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import { formatHeadline, nameList } from "@/lib/format";
import { waitingOn, type DatedEvent } from "@/lib/myEvents";
import PlaceNote from "@/components/myEvents/PlaceNote";

/**
 * A date you've accepted, waiting on the rest of the group: the same two
 * column layout as ScheduledCard (group name and big date on the left, title
 * and status on the right), amber for "waiting" rather than emerald for
 * "everyone's in".
 *
 *     group name   | title             who suggested it
 *     big date     | waiting for Alex
 *     time         | leave
 */
export default function WaitingCard({ event }: { event: DatedEvent }) {
  const t = useT();
  const { lang } = useLang();
  const [exiting, setExiting] = useState(false);
  const headline = formatHeadline(event.settings, event.currentDate, lang, t);

  return (
    <li className="relative grid gap-y-2 rounded-2xl border border-amber-200 bg-amber-50/60 py-4 sm:grid-cols-2 sm:items-baseline sm:gap-y-1.5 sm:py-5">
      {/* The left half's tint, drawn behind its cells. */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 hidden w-1/2 rounded-l-2xl border-r border-amber-200 bg-amber-100/60 sm:block"
      />
      <div className="relative order-1 min-w-0 px-4 sm:order-none sm:px-5">
        <GroupName event={event} buttonClassName="text-amber-800 hover:bg-amber-200/60" />
      </div>
      <div className="relative order-4 mt-3 flex min-w-0 items-baseline justify-between gap-3 px-4 sm:order-none sm:mt-0 sm:px-5">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-amber-800">
          <CalendarClock className="h-4 w-4 shrink-0" />
          <span className="truncate">{eventTitle(event.title, t)}</span>
        </p>
        {/* Who suggested it: the one person who can cancel it. */}
        <p className="shrink-0 text-sm text-muted-foreground">
          {event.createdBy.isYou
            ? t.events.youSuggested
            : t.events.suggestedBy(event.createdBy.name)}
        </p>
      </div>
      <p className="relative order-2 px-4 text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:order-none sm:px-5">
        {headline.lines.join(" ")}
      </p>
      <div className="relative order-5 min-w-0 px-4 sm:order-none sm:px-5">
        <p className="flex items-center gap-1.5 text-xl font-bold text-foreground">
          <Clock className="h-5 w-5 shrink-0 text-amber-600" />
          {t.events.waitingFor(nameList(waitingOn(event), lang))}
        </p>
        <div className="mt-2">
          <People invitees={event.invitees} />
        </div>
        <EdgeWarnings event={event} className="mt-1.5" />
        <DateConflicts event={event} className="mt-1.5" />
        <PlaceNote event={event} className="mt-2" />
      </div>
      <p className="relative order-3 px-4 text-lg text-foreground sm:order-none sm:px-5">
        {headline.time}
        <YourTime kind={event.settings.kind} date={event.currentDate} />
      </p>
      <div className="relative order-6 flex min-w-0 items-baseline justify-end px-4 sm:order-none sm:px-5">
        {!exiting && (
          <ExitLink event={event} onClick={() => setExiting(true)} className="shrink-0" />
        )}
      </div>
      {exiting && (
        <div className="relative order-7 px-4 sm:order-none sm:col-start-2 sm:px-5">
          <ExitConfirm event={event} onCancel={() => setExiting(false)} className="mt-3" />
        </div>
      )}
    </li>
  );
}
