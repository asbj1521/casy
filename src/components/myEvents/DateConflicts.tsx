import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarX, Loader2 } from "lucide-react";

import { declineEvent } from "@/api/events";
import { groupBusyQuery, groupsQuery, participantsFromGroup } from "@/api/groups";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useEventChange } from "@/hooks/useEventChange";
import { useLang, useT } from "@/i18n/lang";
import { cantMake } from "@/lib/eventConflicts";
import { isEventSettings, SEARCH_WINDOW } from "@/lib/eventSearch";
import { nameList } from "@/lib/format";
import type { DatedEvent } from "@/lib/myEvents";
import { cn } from "@/lib/utils";
import { APP_TIME_ZONE } from "@/lib/zone";

/**
 * A date waiting for answers that someone's calendar now rules out (#85):
 * they added something after it was offered. Said to you about yourself,
 * with "Can't make it after all" if you already said yes (declining finds
 * the next date for everyone, as any decline does); said about others so the
 * group isn't surprised. Built from the group's busy times the card already
 * loads, checked by the event's own rules (lib/eventConflicts.ts).
 */
export default function DateConflicts({
  event,
  className,
}: {
  event: DatedEvent;
  className?: string;
}) {
  const t = useT();
  const { lang } = useLang();
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const decline = useEventChange(() => declineEvent(queryClient, userId, event));
  const pending = event.status === "pending";
  const { data: groups } = useQuery({ ...groupsQuery(userId), enabled: pending });
  const { data: busy } = useQuery({
    ...groupBusyQuery(userId, event.group.id, SEARCH_WINDOW.start, SEARCH_WINDOW.end),
    enabled: pending,
  });

  const group = groups?.find((g) => g.id === event.group.id);
  if (!pending || !group || !busy || !isEventSettings(event.settings)) return null;

  const invited = new Set(event.invitees.map((i) => i.profileId));
  const people = participantsFromGroup(group, busy).participants.filter((p) =>
    invited.has(p.profileId),
  );
  const clash = new Set(cantMake(people, event.settings, event.currentDate, APP_TIME_ZONE));
  if (clash.size === 0) return null;

  const youClash = clash.has(userId);
  const youSaidYes = event.invitees.some((i) => i.isYou && i.response === "accepted");
  const others = people.filter((p) => p.profileId !== userId && clash.has(p.profileId));

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {youClash && (
        <Notice tone="warning" icon={CalendarX}>
          <p>{t.events.conflictYou}</p>
          {youSaidYes &&
            (confirming ? (
              <div className="mt-2">
                <p>{t.events.cantMake}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    // The event stays, with the next date for everyone to answer.
                    onClick={() =>
                      decline.mutate(undefined, { onSuccess: () => setConfirming(false) })
                    }
                    disabled={decline.isPending}
                    className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                  >
                    {decline.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t.events.declineFind}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    disabled={decline.isPending}
                    className="rounded-full px-4 py-2 text-sm font-medium transition hover:underline"
                  >
                    {t.events.keepIt}
                  </button>
                </div>
                {decline.error && <p className="mt-2 text-red-700">{decline.error.message}</p>}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  decline.reset();
                  setConfirming(true);
                }}
                className="mt-1 font-semibold underline underline-offset-2"
              >
                {t.events.cantMakeAfterAll}
              </button>
            ))}
        </Notice>
      )}
      {others.length > 0 && (
        <Notice tone="warning" bare icon={CalendarX}>
          {t.events.conflictOthers(
            others.length > 1,
            nameList(
              others.map((p) => p.name),
              lang,
            ),
          )}
        </Notice>
      )}
    </div>
  );
}
