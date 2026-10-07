import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, Check } from "lucide-react";

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
import PlaceNote from "@/components/myEvents/PlaceNote";

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
      <div className="relative order-4 mt-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t border-emerald-200 px-4 pt-3 sm:order-none sm:mt-0 sm:flex-nowrap sm:justify-between sm:gap-3 sm:border-0 sm:px-5 sm:pt-0">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-emerald-800">
          <CalendarCheck className="h-4 w-4 shrink-0" />
          <span className="truncate">{eventTitle(event.title, t)}</span>
        </p>
        {/* Who suggested it: the one person who can cancel it. */}
        <p className="text-sm text-muted-foreground sm:shrink-0">
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
          <p className="flex items-center gap-1.5 text-base font-semibold text-emerald-800 sm:text-xl sm:font-bold sm:text-foreground">
            <Check className="h-4 w-4 shrink-0 sm:hidden" />
            {t.events.acceptedByAll}
          </p>
        )}
        <EdgeWarnings event={event} className="mt-1.5" />
        <PlaceNote event={event} className="mt-2" />
      </div>
      <p className="relative order-3 px-4 text-lg text-foreground sm:order-none sm:px-5">
        {headline.time}
        <YourTime kind={event.settings.kind} date={event.currentDate} />
      </p>
      {/* A phone: the calendar button across the card, its note under it, and
          the smaller ways to change things in a row of their own. */}
      <div className="relative order-6 mt-1 flex min-w-0 flex-col gap-3 px-4 sm:order-none sm:mt-0 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-4 sm:gap-y-2 sm:px-5">
        <div className="min-w-0 sm:flex-1">
          <AddToCalendar event={event} wide />
        </div>
        {!exiting && (
          <span className="flex items-baseline justify-between gap-4 sm:shrink-0 sm:justify-start">
            {/* A vote's answers can be changed after it is decided (#74). */}
            {event.mode === "vote" && (
              <Link
                to={`/events/${event.id}/dates`}
                className="text-sm font-medium text-primary transition hover:opacity-80"
              >
                {t.events.changeAnswers}
              </Link>
            )}
            <ExitLink event={event} onClick={() => setExiting(true)} />
          </span>
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
