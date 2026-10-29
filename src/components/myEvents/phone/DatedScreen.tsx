import { useState } from "react";
import { CalendarX, LogOut } from "lucide-react";

import { answerDate } from "@/api/events";
import AddToCalendar from "@/components/AddToCalendar";
import EventImpactDetails from "@/components/myEvents/EventImpactDetails";
import { EdgeWarnings, ExitConfirm } from "@/components/myEvents/parts";
import DateTile from "@/components/myEvents/phone/DateTile";
import DaySlice from "@/components/myEvents/phone/DaySlice";
import EventScreen from "@/components/myEvents/phone/EventScreen";
import PeopleRow from "@/components/myEvents/phone/PeopleRow";
import PlaceNote from "@/components/myEvents/PlaceNote";
import ReportEventButton from "@/components/safety/ReportEventButton";
import YourTime from "@/components/time/YourTime";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import { useEventChange } from "@/hooks/useEventChange";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import { formatEventDate, formatTime } from "@/lib/format";
import type { DatedEvent } from "@/lib/myEvents";

/**
 * An agreed event's screen in a phone's Aftaler (#177), shown more than
 * told: its date as a tile with the time beside it, your own day around it
 * (DaySlice, opening the day view), everyone's face with a tick for their
 * yes (PeopleRow, the suggester starred), its place and note, and what you
 * can do last, as rows: say you can't after all (an agreed vote, asked
 * first, moving it for everyone, #74), report it, cancel or leave. Its one
 * main action, pinned along the bottom, puts it in your calendar.
 */
export default function DatedScreen({
  event,
  onOpenDay,
}: {
  event: DatedEvent;
  onOpenDay: (day: number) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const [exiting, setExiting] = useState(false);
  const [backingOut, setBackingOut] = useState(false);
  const backOut = useEventChange(() => answerDate(event.id, event.currentDate.id, "declined"));
  const start = Date.parse(event.currentDate.start);
  const end = Date.parse(event.currentDate.end);
  const when =
    event.settings.kind === "single"
      ? `${formatTime(event.currentDate.start)}-${formatTime(event.currentDate.end)}`
      : formatEventDate(event.settings.kind, event.currentDate, lang);

  return (
    <EventScreen action={<AddToCalendar event={event} flow />}>
      <div className="mt-2 flex items-center gap-4">
        <DateTile start={start} size="hero" />
        <div className="min-w-0">
          <p className="text-[17px] font-semibold tabular-nums text-foreground">{when}</p>
          <p className="truncate text-[13px] text-muted-foreground">{event.group.name}</p>
          {/* The time in the viewer's own clock, where it isn't Danish time. */}
          <YourTime kind={event.settings.kind} date={event.currentDate} className="text-[13px]" />
        </div>
      </div>

      <div className="mt-5">
        <DaySlice start={start} end={end} label={eventTitle(event.title, t)} onOpen={onOpenDay} />
      </div>

      <div className="mt-5">
        <PeopleRow
          invitees={event.invitees}
          suggesterId={event.createdBy.id}
          standing={(p) => p.response ?? "waiting"}
          optional={event.settings.people?.optional}
        />
      </div>

      <EdgeWarnings event={event} className="mt-4" />
      <PlaceNote event={event} className="mt-4" />
      <EventImpactDetails event={event} className="mt-4" />

      {backOut.error && (
        <Notice tone="error" bare className="mt-4">
          {backOut.error.message}
        </Notice>
      )}
      {exiting ? (
        <ExitConfirm event={event} onCancel={() => setExiting(false)} className="mt-6" />
      ) : backingOut ? (
        <ConfirmPanel
          className="mt-6"
          message={t.swipe.moveConfirm}
          confirmLabel={t.swipe.moveYes}
          cancelLabel={t.swipe.moveKeep}
          busy={backOut.isPending}
          onConfirm={() => backOut.mutate(undefined, { onSettled: () => setBackingOut(false) })}
          onCancel={() => setBackingOut(false)}
        />
      ) : (
        <ListGroup>
          {event.mode === "vote" && (
            <ListRow
              icon={CalendarX}
              label={t.events.cantAfterAll}
              tone="primary"
              onClick={() => setBackingOut(true)}
            />
          )}
          <ReportEventButton event={event} as="row" />
          <ListRow
            icon={LogOut}
            label={event.createdBy.isYou ? t.events.cancelEvent : t.events.leaveEvent}
            tone="danger"
            onClick={() => setExiting(true)}
          />
        </ListGroup>
      )}
    </EventScreen>
  );
}
