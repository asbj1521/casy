import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { groupsQuery } from "@/api/groups";
import { useSignedInUser } from "@/context/auth";
import type { PlanStart } from "@/hooks/usePlanning";
import { planFromVote } from "@/lib/searchAgain";
import type { VoteEvent } from "@/lib/vote";

/** The fewest and most dates a vote offers (DATE_COUNT_VALUES). */
const MIN_DATES = 2;
const MAX_DATES = 5;

/**
 * Searching an open vote again (#240): who in its group it leaves out, the
 * vote's own plan with the
 * members picked (`add`, none to only look again) among everyone it is for
 * (`planFor`, loosened in a sheet over the vote first, #264), and the way on
 * to Planlæg's pile with it (`runPlan`).
 * Their calendars are thrown onto those already searched; sending gives the
 * vote the new dates. Planlæg opens over the home page and closes back onto
 * the vote.
 */
export function useSearchAgain(event: VoteEvent) {
  const userId = useSignedInUser().id;
  const navigate = useNavigate();
  const { data: groups } = useQuery(groupsQuery(userId));
  const group = groups?.find((g) => g.id === event.group.id);
  const invited = event.invitees.map((i) => i.profileId);
  const missing = group?.members.filter((m) => !invited.includes(m.profileId)) ?? [];

  /** The vote's own plan, with the members picked (`add`) among everyone it is for. */
  const planFor = (add: string[]): PlanStart | null => {
    if (!group) return null;
    const everyone = [...new Set([...invited, ...add])];
    const plan = planFromVote(
      event.settings,
      everyone,
      group.members.map((m) => m.profileId),
    );
    return {
      groupId: group.id,
      settings: plan.sched,
      people: plan.people,
      name: event.title,
      extras: {
        place: event.place ?? "",
        note: event.note ?? "",
        dateCount: Math.min(MAX_DATES, Math.max(MIN_DATES, event.candidates.length)),
      },
      again: { eventId: event.id, add, before: invited, dates: event.candidates },
    };
  };

  /** Planlæg's pile, on `plan` as loosened in the sheet (#264). */
  const runPlan = (plan: PlanStart) =>
    navigate({ search: "?plan" }, { state: { fromMonth: true, planStart: plan } });

  return { missing, ready: !!group, planFor, runPlan };
}
