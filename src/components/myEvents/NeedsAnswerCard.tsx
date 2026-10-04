import { useState } from "react";

import AnswerButtons from "@/components/myEvents/AnswerButtons";
import { EdgeWarnings, ExitConfirm, ExitLink, Origin, People } from "@/components/myEvents/parts";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import { formatEventDate } from "@/lib/format";
import type { DatedEvent } from "@/lib/myEvents";

/**
 * A date waiting for your answer, the one thing My events is for: accept it,
 * or decline it and have the next date found (AnswerButtons). The phone's
 * card; a computer opens the event beside the list instead (EventDetails).
 */
export default function NeedsAnswerCard({ event }: { event: DatedEvent }) {
  const t = useT();
  const { lang } = useLang();
  const [exiting, setExiting] = useState(false);

  return (
    <li className="rounded-2xl border border-primary/30 bg-card p-4 shadow-sm sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">
        {event.group.name} · {eventTitle(event.title, t)}
      </p>
      <p className="mt-1 text-xl font-bold text-foreground">
        {formatEventDate(event.settings.kind, event.currentDate, lang)}
      </p>
      <Origin event={event} />
      <div className="mt-3">
        <People invitees={event.invitees} />
      </div>
      <EdgeWarnings event={event} className="mt-3" />

      <AnswerButtons event={event} />

      {exiting ? (
        <ExitConfirm event={event} onCancel={() => setExiting(false)} className="mt-3" />
      ) : (
        <ExitLink event={event} onClick={() => setExiting(true)} className="mt-3" />
      )}
    </li>
  );
}
