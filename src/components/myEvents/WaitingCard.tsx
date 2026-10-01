import { useState } from "react";
import { Clock } from "lucide-react";

import { EdgeWarnings, ExitConfirm, ExitLink, Origin, People } from "@/components/myEvents/parts";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import { formatEventDate, nameList } from "@/lib/format";
import { waitingOn, type DatedEvent } from "@/lib/myEvents";

/** A date you've said yes to, waiting for the others' answers. */
export default function WaitingCard({ event }: { event: DatedEvent }) {
  const t = useT();
  const { lang } = useLang();
  const [exiting, setExiting] = useState(false);

  return (
    <li className="rounded-2xl border bg-card p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {event.group.name} · {eventTitle(event.title, t)}
      </p>
      <p className="mt-1 text-lg font-bold text-foreground">
        {formatEventDate(event.settings.kind, event.currentDate, lang)}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-amber-700">
        <Clock className="h-4 w-4" />
        {t.events.waitingFor(nameList(waitingOn(event), lang))}
      </p>
      <Origin event={event} />
      <div className="mt-3">
        <People invitees={event.invitees} />
      </div>
      <EdgeWarnings event={event} className="mt-3" />
      {exiting ? (
        <ExitConfirm event={event} onCancel={() => setExiting(false)} className="mt-3" />
      ) : (
        <ExitLink event={event} onClick={() => setExiting(true)} className="mt-3" />
      )}
    </li>
  );
}
