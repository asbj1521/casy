import { useQuery } from "@tanstack/react-query";

import { cancelEvent, leaveEvent, type SuggestedEvent } from "@/api/events";
import { groupBusyQuery, groupsQuery, participantsFromGroup } from "@/api/groups";
import EdgeWarningList from "@/components/EdgeWarningList";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import { useSignedInUser } from "@/context/auth";
import { useEventChange } from "@/hooks/useEventChange";
import { useLang, useT } from "@/i18n/lang";
import { edgeWarnings } from "@/lib/earlyMorning";
import { SEARCH_WINDOW } from "@/lib/eventSearch";
import { formatEventDate } from "@/lib/format";
import type { DatedEvent } from "@/lib/myEvents";
import { cn } from "@/lib/utils";
import { APP_TIME_ZONE } from "@/lib/zone";

/** Where the event came from: who suggested it, and why the date changed if it did. */
export function Origin({ event }: { event: SuggestedEvent }) {
  const { lang } = useLang();
  const t = useT();
  const last = event.declinedDates.at(-1);
  return (
    <p className="mt-1 text-sm text-muted-foreground">
      {event.createdBy.isYou ? t.events.youSuggested : t.events.suggestedBy(event.createdBy.name)}
      {last &&
        t.events.newDateBecause(last.declinedBy, formatEventDate(event.settings.kind, last, lang))}
      .
    </p>
  );
}

/**
 * A meeting's edge warnings, for those still invited: someone coming
 * straight from something that ends as it starts, or having to be up early
 * after a late night (lib/earlyMorning.ts). Meetings only; the group's
 * calendars are the same cached data a decline uses, one fetch per group.
 */
export function EdgeWarnings({ event, className }: { event: DatedEvent; className?: string }) {
  const { lang } = useLang();
  const t = useT();
  const userId = useSignedInUser().id;
  const meeting = event.settings.kind === "single";
  const { data: groups } = useQuery({ ...groupsQuery(userId), enabled: meeting });
  const { data: busy } = useQuery({
    ...groupBusyQuery(userId, event.group.id, SEARCH_WINDOW.start, SEARCH_WINDOW.end),
    enabled: meeting,
  });
  const group = groups?.find((g) => g.id === event.group.id);
  if (!meeting || !group || !busy) return null;

  const invited = new Set(event.invitees.map((i) => i.profileId));
  const participants = participantsFromGroup(group, busy).participants.filter((p) =>
    invited.has(p.profileId),
  );
  const warnings = edgeWarnings(participants, event.currentDate, APP_TIME_ZONE, userId, lang, t);
  if (warnings.length === 0) return null;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <EdgeWarningList warnings={warnings} />
    </div>
  );
}

/**
 * The way out of an event, asked first: whoever suggested it cancels it for
 * everyone; anyone else leaves it, and it goes ahead without them.
 */
export function ExitConfirm({
  event,
  onCancel,
  className,
}: {
  event: SuggestedEvent;
  onCancel: () => void;
  className?: string;
}) {
  const t = useT();
  const isCancel = event.createdBy.isYou;
  // Either way the event then leaves your list, and this card with it.
  const exit = useEventChange(() => (isCancel ? cancelEvent : leaveEvent)(event.id));
  return (
    <ConfirmPanel
      className={className}
      message={isCancel ? t.events.cancelConfirm : t.events.leaveConfirm}
      confirmLabel={isCancel ? t.events.cancelEvent : t.events.leaveEvent}
      cancelLabel={isCancel ? t.events.keepIt : t.events.stayIn}
      busy={exit.isPending}
      error={exit.error?.message}
      onConfirm={() => exit.mutate()}
      onCancel={onCancel}
    />
  );
}
