import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CalendarX, Check, Clock, LogOut, Meh, Users, X } from "lucide-react";

import type { EventInvitee } from "@/api/events";
import { groupsQuery } from "@/api/groups";
import AddToCalendar from "@/components/AddToCalendar";
import AnswerButtons from "@/components/myEvents/AnswerButtons";
import DateConflicts from "@/components/myEvents/DateConflicts";
import { EdgeWarnings, ExitConfirm, Origin } from "@/components/myEvents/parts";
import VoteDetails from "@/components/myEvents/VoteDetails";
import YourTime from "@/components/time/YourTime";
import Avatar from "@/components/ui/Avatar";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { useSignedInUser } from "@/context/auth";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import { formatEventDate, formatHeadline, nameList } from "@/lib/format";
import { waitingOn, type StagedEvent } from "@/lib/myEvents";
import { cn } from "@/lib/utils";

/** Each stage's colour, as its card has it on a phone. */
const STAGE_TONE = {
  needsAnswer: "bg-primary/10 text-primary",
  waiting: "bg-amber-100 text-amber-800",
  scheduled: "bg-emerald-100 text-emerald-800",
  closed: "bg-secondary text-muted-foreground",
} as const;

/**
 * One event in depth, beside the list on a computer's My events: its date
 * big, where it stands, everyone's answer, the dates offered before it and
 * who couldn't make them, and the way out. The phone shows each event as a
 * card instead (NeedsAnswerCard, WaitingCard, ScheduledCard).
 */
export default function EventDetails({ staged }: { staged: StagedEvent }) {
  // A vote still being answered has its own view (#74): no date yet, only dates.
  if (staged.stage === "toSwipe" || staged.stage === "voting") {
    return <VoteDetails event={staged.event} />;
  }
  return <DatedDetails staged={staged} />;
}

function DatedDetails({
  staged,
}: {
  staged: Exclude<StagedEvent, { stage: "toSwipe" | "voting" }>;
}) {
  const t = useT();
  const { lang } = useLang();
  const userId = useSignedInUser().id;
  const [exiting, setExiting] = useState(false);
  const { stage, event } = staged;
  const { data: groups } = useQuery(groupsQuery(userId));
  // A link to the group while you're still in it.
  const inGroup = groups?.some((g) => g.id === event.group.id) ?? false;
  const headline = event.currentDate && formatHeadline(event.settings, event.currentDate, lang, t);

  const stageLabel =
    stage === "needsAnswer"
      ? t.events.needsAnswer
      : stage === "waiting"
        ? t.events.waitingForOthers
        : stage === "scheduled"
          ? t.events.scheduled
          : event.status === "no_date" || !event.currentDate
            ? t.events.stageNoDate
            : t.events.stagePast;

  return (
    <>
      <div className="mt-6 min-w-0">
        <span
          className={cn(
            "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold",
            STAGE_TONE[stage],
          )}
        >
          {stageLabel}
        </span>
        <p className="mt-3 flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm font-semibold text-muted-foreground">
          <Users className="h-4 w-4 shrink-0" />
          {inGroup ? (
            <Link
              to={`/groups/${event.group.id}`}
              className="underline-offset-2 transition hover:text-foreground hover:underline"
            >
              {event.group.name}
            </Link>
          ) : (
            event.group.name
          )}
          <span aria-hidden>·</span>
          <span className="text-foreground">{eventTitle(event.title, t)}</span>
        </p>
        {headline && (
          <>
            <p className="mt-1 text-3xl font-extrabold leading-tight tracking-tight text-foreground">
              {headline.lines.join(" ")}
            </p>
            <p className="text-lg text-foreground">
              {headline.time}
              {event.currentDate && (
                <YourTime kind={event.settings.kind} date={event.currentDate} />
              )}
            </p>
          </>
        )}
        <Origin event={event} />
      </div>

      {stage !== "closed" && <EdgeWarnings event={event} className="mt-3" />}
      {stage !== "closed" && <DateConflicts event={event} className="mt-3" />}

      {stage === "needsAnswer" && <AnswerButtons event={event} />}
      {stage === "waiting" && (
        <p className="mt-4 flex items-center gap-1.5 text-lg font-bold text-foreground">
          <Clock className="h-5 w-5 shrink-0 text-amber-600" />
          {t.events.waitingFor(nameList(waitingOn(event), lang))}
        </p>
      )}
      {stage === "scheduled" && (
        <div className="mt-4">
          {event.invitees.every((i) => i.response === "accepted") && (
            <p className="flex items-center gap-1.5 text-lg font-bold text-foreground">
              <CalendarCheck className="h-5 w-5 shrink-0 text-emerald-600" />
              {t.events.acceptedByAll}
            </p>
          )}
          <div className="mt-2">
            <AddToCalendar event={event} />
          </div>
        </div>
      )}
      {stage === "closed" && (
        <p className="mt-4 text-sm text-muted-foreground">
          {event.status === "no_date" || !event.currentDate
            ? t.events.noDate
            : (event.status === "scheduled" ? t.events.happened : t.events.passed)(
                formatEventDate(event.settings.kind, event.currentDate, lang),
              )}
        </p>
      )}

      <ListGroup title={t.events.answers}>
        {event.invitees.map((person, i) => (
          <ListRow
            key={person.profileId}
            leading={<Avatar name={person.name} index={i} size="row" />}
            label={person.isYou ? t.common.withYou(person.name) : person.name}
            value={<Answer response={person.response} />}
          />
        ))}
      </ListGroup>

      {event.declinedDates.length > 0 && (
        <ListGroup title={t.events.earlierDates}>
          {/* Newest first, like the rest of the page reads back in time. */}
          {[...event.declinedDates].reverse().map((date) => (
            <ListRow
              key={date.start}
              icon={CalendarX}
              label={formatEventDate(event.settings.kind, date, lang)}
              detail={t.events.couldntMake(date.declinedBy)}
            />
          ))}
        </ListGroup>
      )}

      {stage !== "closed" && (
        <ListGroup>
          <ListRow
            icon={event.createdBy.isYou ? X : LogOut}
            label={event.createdBy.isYou ? t.events.cancelEvent : t.events.leaveEvent}
            tone="danger"
            onClick={() => setExiting(true)}
          />
        </ListGroup>
      )}
      {exiting && <ExitConfirm event={event} onCancel={() => setExiting(false)} className="mt-3" />}
    </>
  );
}

/** Where one person stands on the current date, in words and colour. */
function Answer({ response }: { response: EventInvitee["response"] }) {
  const t = useT();
  if (response === "accepted") {
    return (
      <span className="flex items-center gap-1 text-emerald-700">
        <Check className="h-4 w-4" />
        {t.events.answered.accepted}
      </span>
    );
  }
  if (response === "maybe") {
    return (
      <span className="flex items-center gap-1 text-amber-700">
        <Meh className="h-4 w-4" />
        {t.events.answered.maybe}
      </span>
    );
  }
  if (response === "declined") {
    return (
      <span className="flex items-center gap-1 text-rose-700">
        <X className="h-4 w-4" />
        {t.events.answered.declined}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <Clock className="h-4 w-4" />
      {t.events.answered.none}
    </span>
  );
}
