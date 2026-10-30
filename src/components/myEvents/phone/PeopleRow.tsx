import { Check, Clock, Meh, Star, X } from "lucide-react";

import type { EventInvitee, EventResponse } from "@/api/events";
import Avatar from "@/components/ui/Avatar";
import { useLang, useT } from "@/i18n/lang";
import { nameList } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Where someone stands: an answer, or not yet. */
export type Standing = EventResponse | "waiting";

const BADGES = {
  accepted: { Icon: Check, tone: "bg-emerald-500" },
  maybe: { Icon: Meh, tone: "bg-amber-400" },
  declined: { Icon: X, tone: "bg-rose-500" },
  waiting: { Icon: Clock, tone: "bg-zinc-400 dark:bg-zinc-500" },
} as const;

/**
 * Everyone asked, as a row of faces (#177): each with a small badge for
 * where they stand (a tick, a smiley, a cross, a clock), the one who
 * suggested it first with an orange star, those still to answer greyed.
 * Shows what "Accepteret af alle" and "Du foreslog den" used to say.
 */
export default function PeopleRow({
  invitees,
  suggesterId,
  standing,
  optional = [],
}: {
  invitees: EventInvitee[];
  /** Who suggested it; null once they have deleted their account. */
  suggesterId: string | null;
  standing: (person: EventInvitee) => Standing;
  /** Members whose answer decides nothing (#89), named in a footnote. */
  optional?: string[];
}) {
  const t = useT();
  const { lang } = useLang();
  // The suggester first, then as the event lists them.
  const people = [...invitees].sort(
    (a, b) => Number(b.profileId === suggesterId) - Number(a.profileId === suggesterId),
  );
  const optionalNames = people.filter((p) => optional.includes(p.profileId));
  return (
    <div>
      <ul className="flex flex-wrap gap-x-3 gap-y-2">
        {people.map((p) => {
          const stand = standing(p);
          const badge = BADGES[stand];
          const name = p.isYou ? t.events.you : p.name;
          const said = stand === "waiting" ? t.events.answered.none : t.events.answered[stand];
          const suggested =
            p.profileId === suggesterId
              ? `. ${p.isYou ? t.events.youSuggested : t.events.suggestedBy(p.name)}`
              : "";
          return (
            <li
              key={p.profileId}
              aria-label={`${name}: ${said}${suggested}`}
              className="flex w-12 flex-col items-center gap-1"
            >
              <span className={cn("relative", stand === "waiting" && "opacity-50")}>
                <Avatar name={p.name} index={invitees.indexOf(p)} size="row" src={p.avatarUrl} />
                <span
                  aria-hidden
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-white ring-2 ring-background",
                    badge.tone,
                  )}
                >
                  <badge.Icon className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
                {p.profileId === suggesterId && (
                  <span
                    aria-hidden
                    className="absolute -left-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-cta text-white ring-2 ring-background"
                  >
                    <Star className="h-2.5 w-2.5" fill="currentColor" strokeWidth={0} />
                  </span>
                )}
              </span>
              <span
                aria-hidden
                className="w-full truncate text-center text-[11px] text-muted-foreground"
              >
                {name}
              </span>
            </li>
          );
        })}
      </ul>
      {optionalNames.length > 0 && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t.events.optionalAre(
            nameList(
              optionalNames.map((p) => (p.isYou ? t.events.you : p.name)),
              lang,
            ),
          )}
        </p>
      )}
    </div>
  );
}
