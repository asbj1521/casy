import { useState } from "react";
import { Link } from "react-router-dom";

import AddToCalendar from "@/components/AddToCalendar";
import AnswerButtons from "@/components/myEvents/AnswerButtons";
import DateConflicts from "@/components/myEvents/DateConflicts";
import { EdgeWarnings, ExitConfirm, ExitLink, People } from "@/components/myEvents/parts";
import PlaceNote from "@/components/myEvents/PlaceNote";
import YourTime from "@/components/time/YourTime";
import { useLang, useT } from "@/i18n/lang";
import { formatHeadline } from "@/lib/format";
import type { DatedEvent } from "@/lib/myEvents";

/**
 * An opened event with a date on a phone's My events (#103): agreed
 * ("scheduled"), or one of the dates suggested before votes (#74), still
 * waiting for your answer or for the others'. The date and time, who
 * suggested it, who hasn't said yes, its place and note, and what you can do:
 * put it in your calendar, answer, change your answers, cancel or leave.
 */
export default function DatedSummary({
  event,
  stage,
}: {
  event: DatedEvent;
  stage: "needsAnswer" | "waiting" | "scheduled";
}) {
  const t = useT();
  const { lang } = useLang();
  const [exiting, setExiting] = useState(false);
  const headline = formatHeadline(event.settings, event.currentDate, lang, t);
  const notYes = event.invitees.filter((i) => i.response !== "accepted");
  const pending = stage !== "scheduled";

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <p className="text-lg font-bold leading-tight text-foreground">
          {headline.lines.join(" ")}
        </p>
        <p className="text-foreground">
          {headline.time}
          <YourTime kind={event.settings.kind} date={event.currentDate} />
        </p>
        <p className="text-muted-foreground">
          {event.createdBy.isYou
            ? t.events.youSuggested
            : t.events.suggestedBy(event.createdBy.name)}
        </p>
      </div>

      {notYes.length > 0 ? (
        <People
          invitees={pending ? event.invitees : notYes}
          optional={event.settings.people?.optional}
        />
      ) : (
        <p className="font-medium text-emerald-800">{t.events.acceptedByAll}</p>
      )}
      <EdgeWarnings event={event} />
      {pending && <DateConflicts event={event} />}
      <PlaceNote event={event} />

      {stage === "needsAnswer" && <AnswerButtons event={event} />}
      {stage === "scheduled" && <AddToCalendar event={event} wide />}

      {exiting ? (
        <ExitConfirm event={event} onCancel={() => setExiting(false)} />
      ) : (
        <div className="flex items-baseline justify-between gap-4">
          {/* A vote's answers can be changed after it is decided (#74). */}
          {event.mode === "vote" ? (
            <Link to={`/events/${event.id}/dates`} className="font-medium text-primary">
              {t.events.changeAnswers}
            </Link>
          ) : (
            <span />
          )}
          <ExitLink event={event} onClick={() => setExiting(true)} />
        </div>
      )}
    </div>
  );
}
