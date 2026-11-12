import { motion, useReducedMotion } from "framer-motion";

import type { CandidateDate, EventInvitee } from "@/api/events";
import Avatar from "@/components/ui/Avatar";
import Collapse from "@/components/ui/Collapse";
import { useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";
import { whoOnDate } from "@/lib/vote";

/** The most faces a date's row stacks before it says "+n". */
const MAX_FACES = 7;
/** How a face glides between the row and its group (#258). */
const GLIDE = { type: "spring", stiffness: 420, damping: 34 } as const;

/** One face, the same one in the row and in its group, so it glides between them. */
function Face({
  person,
  index,
  dateId,
  faded = false,
  size = "xs",
}: {
  person: EventInvitee;
  index: number;
  dateId: string;
  faded?: boolean;
  size?: "xs" | "sm";
}) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      layoutId={reduce ? undefined : `voter-${dateId}-${person.profileId}`}
      transition={GLIDE}
      className={cn("inline-flex rounded-full ring-2 ring-card", faded && "opacity-45")}
    >
      <Avatar name={person.name} index={index} size={size} src={person.avatarUrl} />
    </motion.span>
  );
}

/**
 * Who can on one date (#258), in a vote's row in place of a bar: the faces of
 * those who can, overlapping, then those who would rather not, paler, so the
 * row still reads as a bar filling up, and says who. The numbers are for
 * screen readers (`label`). Hidden while the date is open: its faces have
 * glided down into their groups (DateVotersOpen).
 */
export function DateFaces({
  date,
  invitees,
  open,
  label,
}: {
  date: CandidateDate;
  invitees: EventInvitee[];
  open: boolean;
  label: string;
}) {
  const who = whoOnDate(date, invitees);
  const can = [...who.accepted, ...who.maybe];
  const shown = can.slice(0, MAX_FACES);
  const more = can.length - shown.length;
  return (
    <span role="img" aria-label={label} className="mt-1.5 flex h-5 items-center">
      {!open &&
        shown.map((p, i) => (
          <span key={p.profileId} className={cn(i > 0 && "-ml-1.5")}>
            <Face
              person={p}
              index={invitees.indexOf(p)}
              dateId={date.id}
              faded={date.answers[p.profileId] === "maybe"}
            />
          </span>
        ))}
      {!open && more > 0 && (
        <span className="ml-1 text-[0.75rem] font-medium text-muted-foreground">+{more}</span>
      )}
      {!open && can.length === 0 && <span className="h-1.5 w-full rounded-full bg-secondary" />}
    </span>
  );
}

/**
 * A date opened (#258): everyone by what they answered, Kan, Helst ikke,
 * Kan ikke and Mangler svar, each face with its name, gliding here from the
 * row (a shared layoutId) and back as it closes. A group nobody is in is left
 * out.
 */
export function DateVotersOpen({
  date,
  invitees,
  open,
}: {
  date: CandidateDate;
  invitees: EventInvitee[];
  open: boolean;
}) {
  const t = useT();
  const who = whoOnDate(date, invitees);
  const groups = [
    { key: "accepted", title: t.events.voters.accepted, people: who.accepted },
    { key: "maybe", title: t.events.voters.maybe, people: who.maybe },
    { key: "declined", title: t.events.voters.declined, people: who.declined },
    { key: "missing", title: t.events.voters.missing, people: who.missing },
  ].filter((g) => g.people.length > 0);
  return (
    <Collapse open={open}>
      <div className="flex flex-col gap-3 pb-3 pr-4 pt-1">
        {open &&
          groups.map((g) => (
            <div key={g.key}>
              <p className="text-[0.75rem] font-medium uppercase tracking-wide text-muted-foreground">
                {g.title}
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1.5">
                {g.people.map((p) => (
                  <li key={p.profileId} className="flex items-center gap-1.5">
                    <Face
                      person={p}
                      index={invitees.indexOf(p)}
                      dateId={date.id}
                      faded={g.key === "missing"}
                      size="sm"
                    />
                    <span className="text-[0.8125rem] text-foreground">
                      {p.isYou ? t.events.you : p.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </Collapse>
  );
}
