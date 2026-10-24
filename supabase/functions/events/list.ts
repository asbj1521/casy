/** The events function's list: every event the caller is in, as the page shows them (#160, split out of index.ts). */
import { currentDate, type EventMode } from "../_shared/events.ts";
import { cleanProfile } from "../_shared/profileAi.ts";
import { type Db } from "../_shared/supabaseAdmin.ts";

/** How many events the list returns, newest first. Plenty for a person's groups. */
export const LIST_LIMIT = 100;

export type DateRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  declined_by: string | null;
  declined_at: string | null;
  created_at: string;
  chosen_at: string | null;
  /** How well the date suits the group by their important events, 0 to 100 (#119). */
  match_score: number | null;
};

export type ProposalRow = {
  id: string;
  group_id: string;
  created_by: string | null;
  title: string;
  place: string | null;
  note: string | null;
  settings: { kind?: string } | null;
  status: string;
  mode: EventMode;
  answer_by: string | null;
  /** What the event is likely to cause (#113); null when none came with it. */
  impact: unknown;
  created_at: string;
  updated_at: string;
  friend_groups: { name: string } | null;
  event_proposal_dates: DateRow[];
};

export type WriteRow = {
  wanted: boolean;
  added: boolean;
  last_error: string | null;
  gone_at: string | null;
  on_phone: boolean;
};

/** `onPhone`: the calendar is on a phone, whose app adds it when it next runs (#105). */
export type MyCalendar =
  { state: "added" | "gone" } | { state: "adding"; error: string | null; onPhone: boolean } | null;

/**
 * Every event the caller was invited to, in groups they are still in, or
 * just the one with the id `only`.
 *
 * Four round trips whatever the number of events: the caller's groups, the
 * events with their dates embedded, everyone invited with their answers to
 * each current date (and to every date of a vote), and the names.
 */
export async function listEvents(db: Db, profileId: string, callerName: string, only?: string) {
  const { data: memberships, error: memErr } = await db
    .from("group_members")
    .select("group_id")
    .eq("profile_id", profileId);
  if (memErr) throw memErr;
  const groupIds = memberships.map((m) => m.group_id);
  if (groupIds.length === 0) return [];

  let query = db
    .from("event_proposals")
    .select(
      "id, group_id, created_by, title, place, note, settings, status, mode, answer_by, impact, " +
        "created_at, " +
        "updated_at, friend_groups(name), " +
        "event_proposal_dates(id, starts_at, ends_at, declined_by, declined_at, created_at, " +
        "chosen_at, match_score), " +
        "event_invitees!inner(profile_id)",
    )
    .in("group_id", groupIds)
    // Only events this person was asked about. The !inner join filters on
    // their invitee row, so the embedded invitees are fetched separately below.
    .eq("event_invitees.profile_id", profileId);
  if (only) query = query.eq("id", only);
  const { data: rows, error: rowsErr } = await query
    .order("updated_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (rowsErr) throw rowsErr;
  const proposals = rows as unknown as ProposalRow[];
  if (proposals.length === 0) return [];

  const proposalIds = proposals.map((p) => p.id);
  const current = new Map(
    proposals.map((p) => [p.id, currentDate(p.event_proposal_dates, p.mode)]),
  );
  // The answers wanted: to each current date, and to every date of a vote.
  const answeredIds = [
    ...new Set([
      ...[...current.values()].filter((d) => d !== null).map((d) => d.id),
      ...proposals
        .filter((p) => p.mode === "vote")
        .flatMap((p) => p.event_proposal_dates.map((d) => d.id)),
    ]),
  ];

  // Everyone invited, their answers to each current date, and whether Casy
  // put each event into the caller's own calendar: none needs another, so
  // all are asked at once. Every accept and decline waits on this list.
  const [invitees, answers, writes] = await Promise.all([
    db.from("event_invitees").select("proposal_id, profile_id").in("proposal_id", proposalIds),
    answeredIds.length > 0
      ? db
          .from("event_responses")
          .select("date_id, profile_id, response")
          .in("date_id", answeredIds)
      : { data: [], error: null },
    db
      .from("calendar_event_writes")
      .select("proposal_id, wanted, added, last_error, gone_at, on_phone")
      .eq("profile_id", profileId)
      .in("proposal_id", proposalIds),
  ]);
  if (invitees.error) throw invitees.error;
  if (answers.error) throw answers.error;
  if (writes.error) throw writes.error;

  const writeOf = new Map(writes.data.map((w) => [w.proposal_id, w]));
  const inviteesOf = new Map<string, string[]>();
  for (const r of invitees.data) {
    inviteesOf.set(r.proposal_id, [...(inviteesOf.get(r.proposal_id) ?? []), r.profile_id]);
  }
  const answerOf = new Map<string, string>(
    answers.data.map((a) => [`${a.date_id}:${a.profile_id}`, a.response]),
  );

  const peopleIds = new Set<string>();
  for (const p of proposals) {
    for (const id of inviteesOf.get(p.id) ?? []) peopleIds.add(id);
    if (p.created_by) peopleIds.add(p.created_by);
    for (const d of p.event_proposal_dates) if (d.declined_by) peopleIds.add(d.declined_by);
  }
  const { data: names, error: namesErr } = await db
    .from("profiles")
    .select("id, display_name")
    .in("id", [...peopleIds]);
  if (namesErr) throw namesErr;
  const nameById = new Map<string, string>();
  for (const n of names) if (n.display_name) nameById.set(n.id, n.display_name);
  const nameOf = (id: string | null) =>
    !id ? "Someone" : (nameById.get(id) ?? (id === profileId ? callerName : "Someone"));

  return proposals.map((p) => {
    const date = current.get(p.id) ?? null;
    const write = writeOf.get(p.id);
    const invited = inviteesOf.get(p.id) ?? [];
    return {
      id: p.id,
      group: { id: p.group_id, name: p.friend_groups?.name ?? "A group" },
      title: p.title,
      place: p.place,
      note: p.note,
      settings: p.settings,
      status: p.status,
      mode: p.mode,
      answerBy: p.answer_by,
      // Read through the same cleaner as when it came in, so a profile
      // stored by an older version answers in today's shape.
      impact: p.impact ? cleanProfile(p.impact) : null,
      createdBy: {
        id: p.created_by,
        name: nameOf(p.created_by),
        isYou: p.created_by === profileId,
      },
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      currentDate: date ? { id: date.id, start: date.starts_at, end: date.ends_at } : null,
      invitees: invited
        .map((id) => ({
          profileId: id,
          name: nameOf(id),
          isYou: id === profileId,
          response: date ? (answerOf.get(`${date.id}:${id}`) ?? null) : null,
        }))
        // You first, then everyone else by name.
        .sort((a, b) => Number(b.isYou) - Number(a.isYou) || a.name.localeCompare(b.name)),
      declinedDates: p.event_proposal_dates
        .filter((d) => d.declined_at !== null)
        .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
        .map((d) => ({ start: d.starts_at, end: d.ends_at, declinedBy: nameOf(d.declined_by) })),
      // A vote's dates, soonest first, each with the answers of everyone
      // still invited (by profile id). Empty for a single-date event.
      candidates:
        p.mode === "vote"
          ? [...p.event_proposal_dates]
              .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
              .map((d) => ({
                id: d.id,
                start: d.starts_at,
                end: d.ends_at,
                // How well it suits the group by their important events (#119).
                matchScore: d.match_score,
                answers: Object.fromEntries(
                  invited.flatMap((id) => {
                    const answer = answerOf.get(`${d.id}:${id}`);
                    return answer ? [[id, answer]] : [];
                  }),
                ),
              }))
          : [],
      myCalendar: myCalendarState(write),
    };
  });
}

/**
 * The event in the caller's own calendar: "added", "adding" (wanted, not
 * there yet, with the last failure if any), "gone" (added, then deleted by
 * hand), or null when Casy hasn't been asked.
 */
export function myCalendarState(write: WriteRow | undefined): MyCalendar {
  if (!write) return null;
  if (!write.wanted) return write.gone_at && !write.added ? { state: "gone" } : null;
  return write.added
    ? { state: "added" }
    : { state: "adding", error: write.last_error, onPhone: write.on_phone };
}
