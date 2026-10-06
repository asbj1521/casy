import { useState } from "react";
import { CalendarCheck } from "lucide-react";

import AddToCalendar from "@/components/AddToCalendar";
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
import { formatHeadline } from "@/lib/format";
import type { DatedEvent } from "@/lib/myEvents";

/**
 * A date everyone has accepted: the date and time big, who still hasn't said
 * yes (normally nobody), and putting it into your calendar.
 *
 * One grid for both halves, so each row lines up across them:
 *
 *     group name   | title             who suggested it
 *     big date     | accepted by all
 *     time         | calendar          cancel / leave
 *
 * In the markup the cells go row by row; on phones (one column) `order` puts
 * the left half first instead.
 */
export default function ScheduledCard({ event }: { event: DatedEvent }) {
  const t = useT();
  const { lang } = useLang();
  const [exiting, setExiting] = useState(false);
  const headline = formatHeadline(event.settings, event.currentDate, lang, t);
  const pending = event.invitees.filter((i) => i.response !== "accepted");

  return (
    <li className="relative grid gap-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 py-4 sm:grid-cols-2 sm:items-baseline sm:gap-y-1.5 sm:py-5">
      {/* The left half's tint, drawn behind its cells. */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 hidden w-1/2 rounded-l-2xl border-r border-emerald-200 bg-emerald-100/60 sm:block"
      />
      <div className="relative order-1 min-w-0 px-4 sm:order-none sm:px-5">
        <GroupName event={event} buttonClassName="text-emerald-800 hover:bg-emerald-200/60" />
      </div>
      <div className="relative order-4 mt-3 flex min-w-0 items-baseline justify-between gap-3 px-4 sm:order-none sm:mt-0 sm:px-5">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-emerald-800">
          <CalendarCheck className="h-4 w-4 shrink-0" />
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
        {pending.length > 0 ? (
          <People invitees={pending} />
        ) : (
          <p className="text-xl font-bold text-foreground">{t.events.acceptedByAll}</p>
        )}
        <EdgeWarnings event={event} className="mt-1.5" />
      </div>
      <p className="relative order-3 px-4 text-lg text-foreground sm:order-none sm:px-5">
        {headline.time}
        <YourTime kind={event.settings.kind} date={event.currentDate} />
      </p>
      <div className="relative order-6 flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-2 px-4 sm:order-none sm:px-5">
        <div className="min-w-0 flex-1">
          <AddToCalendar event={event} />
        </div>
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
