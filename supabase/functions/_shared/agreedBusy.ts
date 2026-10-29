/**
 * Events Casy has agreed on (#172), as busy time in a group's search: each
 * member's own scheduled events at their decided date, so a new plan doesn't
 * land on top of one, whether or not it was ever put into a calendar. Only
 * the times cross over, never what the event is. A member who said no to the
 * decided date isn't going, so it isn't theirs. An event also written into a
 * calendar is then there twice, which the search's merging makes one.
 */
import { currentDate } from "./events.ts";

export interface AgreedInvite {
  profile_id: string;
  event_proposals: {
    event_proposal_dates: {
      id: string;
      starts_at: string;
      ends_at: string;
      declined_at: string | null;
      created_at: string;
      chosen_at: string | null;
    }[];
  };
}

/**
 * The busy blocks agreed events give each member within [from, to): `declined`
 * holds "dateId:profileId" for every no.
 */
export function agreedBusy(
  invites: AgreedInvite[],
  declined: ReadonlySet<string>,
  from: Date,
  to: Date,
): Map<string, { start: string; end: string }[]> {
  const busy = new Map<string, { start: string; end: string }[]>();
  for (const invite of invites) {
    const date = currentDate(invite.event_proposals.event_proposal_dates);
    if (!date) continue;
    if (declined.has(`${date.id}:${invite.profile_id}`)) continue;
    if (Date.parse(date.starts_at) >= to.getTime() || Date.parse(date.ends_at) <= from.getTime()) {
      continue;
    }
    const blocks = busy.get(invite.profile_id) ?? [];
    blocks.push({ start: date.starts_at, end: date.ends_at });
    busy.set(invite.profile_id, blocks);
  }
  return busy;
}
