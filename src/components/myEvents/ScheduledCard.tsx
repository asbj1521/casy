import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, ChevronDown, Users } from "lucide-react";

import type { SuggestedEvent } from "@/api/events";
import { groupsQuery } from "@/api/groups";
import AddToCalendar from "@/components/AddToCalendar";
import { EdgeWarnings, ExitConfirm, ExitLink, People } from "@/components/myEvents/parts";
import Avatar from "@/components/ui/Avatar";
import { useSignedInUser } from "@/context/auth";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import { formatHeadline } from "@/lib/format";
import type { DatedEvent } from "@/lib/myEvents";
import { cn } from "@/lib/utils";

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
        <GroupName event={event} />
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

/**
 * The group's name as a button that opens a floating box with its members.
 * The box closes when the pointer leaves it (or the name), and on a tap
 * outside or Escape, since a touch screen has no pointer to move away.
 * Members come from your cached groups; a group you've since left falls back
 * to the people invited to this event.
 */
function GroupName({ event }: { event: SuggestedEvent }) {
  const t = useT();
  const userId = useSignedInUser().id;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: groups } = useQuery(groupsQuery(userId));
  const group = groups?.find((g) => g.id === event.group.id);
  const members = (group?.members ?? event.invitees).map((m) => (m.isYou ? t.events.you : m.name));

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (
        e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative z-10" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t.events.showMembers(event.group.name)}
        className="-mx-1.5 flex max-w-full items-center gap-1.5 rounded-lg px-1.5 text-left text-sm font-semibold text-emerald-800 transition hover:bg-emerald-200/60"
      >
        <Users className="h-4 w-4 shrink-0" />
        <span className="min-w-0 break-words">{event.group.name}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        // Padded rather than spaced from the name, so the pointer never
        // crosses a gap (and leaves) on its way into the box.
        <div className="absolute left-0 top-full z-20 pt-1">
          <ul className="flex w-56 max-w-[70vw] flex-col gap-1 rounded-xl border bg-card p-2 shadow-lg">
            {members.map((name, i) => (
              <li
                key={`${name}-${i}`}
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm text-foreground"
              >
                <Avatar name={name} index={i} />
                <span className="truncate">{name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
