import { useQuery } from "@tanstack/react-query";
import { Check, Clock, X } from "lucide-react";

import { cancelEvent, leaveEvent, type EventInvitee, type SuggestedEvent } from "@/api/events";
import { groupBusyQuery, groupsQuery, participantsFromGroup } from "@/api/groups";
import EdgeWarningList from "@/components/EdgeWarningList";
import Avatar from "@/components/ui/Avatar";
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

/** Everyone asked, each with where they stand on the current date. */
export function People({ invitees }: { invitees: EventInvitee[] }) {
  const t = useT();
  return (
    <ul className="flex flex-wrap gap-1.5">
      {invitees.map((p, i) => (
        <li
          key={p.profileId}
          className={cn(
            "flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs",
            p.response === "accepted" && "border-emerald-200 bg-emerald-50 text-emerald-800",
            p.response === "declined" && "border-rose-200 bg-rose-50 text-rose-800",
            p.response === null && "bg-background text-muted-foreground",
          )}
        >
          <Avatar name={p.name} index={i} size="xs" />
          {p.isYou ? t.events.you : p.name}
          {p.response === "accepted" ? (
            <Check className="h-3 w-3" />
          ) : p.response === "declined" ? (
            <X className="h-3 w-3" />
          ) : (
            <Clock className="h-3 w-3" />
          )}
        </li>
      ))}
    </ul>
  );
}

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
 * The way out of an event: whoever suggested it cancels it for everyone;
 * anyone else leaves it, and it goes ahead without them. ExitConfirm asks
 * first, and the card decides where each sits.
 */
export function ExitLink({
  event,
  onClick,
  className,
}: {
  event: SuggestedEvent;
  onClick: () => void;
  className?: string;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-sm font-medium text-muted-foreground transition hover:text-red-700",
        className,
      )}
    >
      {event.createdBy.isYou ? t.events.cancelEvent : t.events.leaveEvent}
    </button>
  );
}

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
