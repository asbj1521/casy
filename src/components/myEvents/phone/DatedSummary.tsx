import { useState } from "react";

import { answerDate } from "@/api/events";
import AddToCalendar from "@/components/AddToCalendar";
import AnswerButtons from "@/components/myEvents/AnswerButtons";
import DateConflicts from "@/components/myEvents/DateConflicts";
import { EdgeWarnings, ExitConfirm, ExitLink, People } from "@/components/myEvents/parts";
import PlaceNote from "@/components/myEvents/PlaceNote";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import Notice from "@/components/ui/Notice";
import { useEventChange } from "@/hooks/useEventChange";
import YourTime from "@/components/time/YourTime";
import { useT } from "@/i18n/lang";
import type { DatedEvent } from "@/lib/myEvents";

/**
 * An opened event with a date on a phone's My events (#103): agreed
 * ("scheduled"), or one of the dates suggested before votes (#74), still
 * waiting for your answer or for the others'. Its date and time are on the
 * row above, so not repeated here: who suggested it, who hasn't said yes, its place and note, and what you can do:
 * put it in your calendar, answer, cancel or leave, and for an agreed vote
 * say you can't make it after all, which moves it for everyone (asked
 * first, as on the swipe screen, #74).
 */
export default function DatedSummary({
  event,
  stage,
}: {
  event: DatedEvent;
  stage: "needsAnswer" | "waiting" | "scheduled";
}) {
  const t = useT();
  const [exiting, setExiting] = useState(false);
  const [backingOut, setBackingOut] = useState(false);
  const backOut = useEventChange(() => answerDate(event.id, event.currentDate.id, "declined"));
  const canBackOut = stage === "scheduled" && event.mode === "vote";
  const notYes = event.invitees.filter((i) => i.response !== "accepted");
  const pending = stage !== "scheduled";

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        {/* The time in the viewer's own clock, where it isn't Danish time. */}
        <YourTime kind={event.settings.kind} date={event.currentDate} />
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

      {backOut.error && (
        <Notice tone="error" bare>
          {backOut.error.message}
        </Notice>
      )}
      {exiting ? (
        <ExitConfirm event={event} onCancel={() => setExiting(false)} />
      ) : backingOut ? (
        <ConfirmPanel
          message={t.swipe.moveConfirm}
          confirmLabel={t.swipe.moveYes}
          cancelLabel={t.swipe.moveKeep}
          busy={backOut.isPending}
          onConfirm={() => backOut.mutate(undefined, { onSettled: () => setBackingOut(false) })}
          onCancel={() => setBackingOut(false)}
        />
      ) : (
        <div className="flex items-baseline justify-between gap-4">
          {canBackOut ? (
            <button
              type="button"
              onClick={() => setBackingOut(true)}
              className="font-medium text-primary"
            >
              {t.events.cantAfterAll}
            </button>
          ) : (
            <span />
          )}
          <ExitLink event={event} onClick={() => setExiting(true)} />
        </div>
      )}
    </div>
  );
}
