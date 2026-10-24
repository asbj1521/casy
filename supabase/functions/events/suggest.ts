/** What a suggestion needs besides its dates: who is invited, its place and note, and each date's score (#160, split out of index.ts). */
import { cleanEventDetail, MAX_NOTE_LENGTH, MAX_PLACE_LENGTH } from "../_shared/events.ts";
import { HttpError } from "../_shared/http.ts";
import { scoreDates } from "../_shared/rankDates.ts";
import { cleanProfile } from "../_shared/profileAi.ts";
import { type Db } from "../_shared/supabaseAdmin.ts";

/**
 * Who a vote invites (#89): the members its settings name, all in the group
 * and the suggester among them; null (everyone in the group, as before)
 * when the settings name nobody.
 */
export async function invitedMembers(
  db: Db,
  groupId: string,
  profileId: string,
  settings: unknown,
): Promise<string[] | null> {
  const people = (settings as { people?: { members: string[] } }).people;
  if (!people) return null;
  const { data, error } = await db
    .from("group_members")
    .select("profile_id")
    .eq("group_id", groupId);
  if (error) throw error;
  const inGroup = new Set(data.map((m) => m.profile_id as string));
  const members = people.members.map((id) => id.toLowerCase());
  if (!members.every((id) => inGroup.has(id))) {
    throw new HttpError(400, "Everyone invited must be in the group.");
  }
  if (!members.includes(profileId)) {
    throw new HttpError(400, "You can't leave yourself out of your own event.");
  }
  return members;
}

/**
 * The place and note in a request (#84): each optional, tidied, and capped
 * like the table's checks. Anything that isn't text is refused.
 */
export function eventDetails(body: Record<string, unknown>): {
  place: string | null;
  note: string | null;
} {
  const place = cleanEventDetail(body.place, MAX_PLACE_LENGTH);
  const note = cleanEventDetail(body.note, MAX_NOTE_LENGTH);
  if (place === undefined || note === undefined) {
    throw new HttpError(400, "The place and note must be text.");
  }
  return { place, note };
}

/**
 * Gives each date of a new vote the score it earns now (#119): stored on the
 * date so every member's card shows the same number. No profile (none came
 * with the event) scores on the timing alone.
 */
export async function storeMatchScores(
  db: Db,
  proposalId: string,
  members: string[],
  impact: ReturnType<typeof cleanProfile>,
  settings: unknown,
) {
  const { data, error } = await db
    .from("event_proposal_dates")
    .select("id, starts_at, ends_at")
    .eq("proposal_id", proposalId);
  if (error) throw error;
  const dates = (data ?? []) as { id: string; starts_at: string; ends_at: string }[];
  const { scores, counted } = await scoreDates(db, {
    members,
    profile: impact,
    single: (settings as { kind?: string }).kind === "single",
    dates: dates.map((d) => ({ start: d.starts_at, end: d.ends_at })),
  });
  // Nobody sharing anything means no score to show, not a perfect one.
  if (counted === 0) return;
  for (const [i, date] of dates.entries()) {
    const { error: updateError } = await db
      .from("event_proposal_dates")
      .update({ match_score: scores[i] })
      .eq("id", date.id);
    if (updateError) throw updateError;
  }
}
