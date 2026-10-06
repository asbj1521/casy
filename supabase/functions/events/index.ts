/**
 * Suggested events: suggest a date to your group, answer one suggested to
 * you, cancel one you suggested, leave one someone else suggested, and list
 * everything you're part of.
 *
 * One function with an `action` in the POST body, the same shape as `groups`.
 * Identity always comes from the caller's verified login (_shared/auth.ts);
 * a group or event id in the request gets you no further than your own
 * membership already does.
 *
 * The search that finds dates runs in the browser (src/lib/eventSearch.ts),
 * which already has the group's calendars. So a decline arrives with the next
 * date attached; this function checks it is a sensible date after the one
 * being declined, and the database swaps it in atomically (respond_to_event).
 *
 * Events suggested since #74 are votes instead: several dates at once, which
 * everyone answers (answer: can, rather not, can't) by swiping through them.
 * The database decides a vote once everyone has answered or its deadline
 * passes (decide_vote); if every date has a decline, the suggester picks
 * one (choose). Votes past their deadline are decided on the next list.
 *
 * What members see of each other here: names, and who has accepted or
 * declined which date. Never an email, a calendar or an event title from
 * anyone's calendar.
 *
 * Agreed events also go into people's primary calendars (calendarWrites.ts):
 * on an "Add to my calendar" click (add-to-calendar), or on their own for
 * anyone with "Add automatically" on, once an event is scheduled. A cancel
 * takes them out again. The calendar work runs after the answer is sent, so
 * accepting or cancelling never waits on iCloud; the hourly sync retries
 * whatever didn't work. `ics` hands out the same entry as a file, for
 * people with no primary calendar.
 */
import { requireCaller } from "../_shared/auth.ts";
import {
  catchUpWrites,
  processWrites,
  unwantEverywhere,
  wantInCalendar,
} from "../_shared/calendarWrites.ts";
import { buildEventIcs, eventResourceName } from "../_shared/eventIcs.ts";
import {
  cleanEventTitle,
  currentDate,
  type EventMode,
  isEventSettings,
  parseCandidateDates,
  parseEventDate,
  VOTE_ANSWER_MS,
} from "../_shared/events.ts";
import { displayNameFor, requireMember } from "../_shared/groups.ts";
import { afterResponse, HttpError, requireString, serve } from "../_shared/http.ts";
import { langOf } from "../_shared/i18n.ts";
import { encryptionKeyFromEnv } from "../_shared/secretBox.ts";
import { type Db, supabaseAdmin } from "../_shared/supabaseAdmin.ts";

/** How many events the list returns, newest first. Plenty for a person's groups. */
const LIST_LIMIT = 100;

type DateRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  declined_by: string | null;
  declined_at: string | null;
  created_at: string;
  chosen_at: string | null;
};

type ProposalRow = {
  id: string;
  group_id: string;
  created_by: string | null;
  title: string;
  settings: { kind?: string } | null;
  status: string;
  mode: EventMode;
  answer_by: string | null;
  created_at: string;
  updated_at: string;
  friend_groups: { name: string } | null;
  event_proposal_dates: DateRow[];
};

type WriteRow = {
  wanted: boolean;
  added: boolean;
  last_error: string | null;
  gone_at: string | null;
};

type MyCalendar = { state: "added" | "gone" } | { state: "adding"; error: string | null } | null;

/**
 * Every event the caller was invited to, in groups they are still in, or
 * just the one with the id `only`.
 *
 * Four round trips whatever the number of events: the caller's groups, the
 * events with their dates embedded, everyone invited with their answers to
 * each current date (and to every date of a vote), and the names.
 */
async function listEvents(db: Db, profileId: string, callerName: string, only?: string) {
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
      "id, group_id, created_by, title, settings, status, mode, answer_by, created_at, " +
        "updated_at, friend_groups(name), " +
        "event_proposal_dates(id, starts_at, ends_at, declined_by, declined_at, created_at, " +
        "chosen_at), " +
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
      .select("proposal_id, wanted, added, last_error, gone_at")
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
      settings: p.settings,
      status: p.status,
      mode: p.mode,
      answerBy: p.answer_by,
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
function myCalendarState(write: WriteRow | undefined): MyCalendar {
  if (!write) return null;
  if (!write.wanted) return write.gone_at && !write.added ? { state: "gone" } : null;
  return write.added ? { state: "added" } : { state: "adding", error: write.last_error };
}

serve("events", async (req, body) => {
  const action = requireString(body, "action");
  const db = supabaseAdmin();
  const caller = await requireCaller(req, db);
  const profileId = caller.id;
  const callerName = displayNameFor(caller);
  const list = async () => ({ events: await listEvents(db, profileId, callerName) });
  const one = async (proposalId: string) => {
    const [event] = await listEvents(db, profileId, callerName, proposalId);
    if (!event) throw new HttpError(404, "That event no longer exists.");
    return event;
  };
  // After a change that may have scheduled or cancelled an event: its
  // calendar entries brought in line once the answer has gone. A failure
  // there is only logged; the hourly sync tries again.
  const syncCalendarsLater = (proposalId: string) =>
    afterResponse("calendar writes after an event change", () =>
      catchUpWrites(db, encryptionKeyFromEnv(), { proposalId }),
    );

  switch (action) {
    case "list": {
      // Votes past their deadline are decided as soon as anyone in them looks.
      const { data: decided, error } = await db.rpc("decide_due_votes", {
        p_profile_id: profileId,
      });
      if (error) throw error;
      for (const proposalId of (decided ?? []) as string[]) syncCalendarsLater(proposalId);
      return await list();
    }

    case "suggest": {
      const groupId = requireString(body, "groupId");
      const title = cleanEventTitle(body.title);
      if (!title) throw new HttpError(400, "Give the event a name.");
      if (!isEventSettings(body.settings)) {
        throw new HttpError(400, "Those event settings aren't valid.");
      }

      // Several dates: a vote (#74). Everyone, the suggester included,
      // answers them; nothing is scheduled until then.
      if (body.dates !== undefined) {
        const dates = parseCandidateDates(body.dates);
        if (!dates) throw new HttpError(400, "Those dates aren't valid any more. Search again.");
        await requireMember(db, groupId, profileId);
        const { data: proposalId, error } = await db.rpc("suggest_vote_event", {
          p_group_id: groupId,
          p_created_by: profileId,
          p_title: title,
          p_settings: body.settings,
          p_dates: dates,
          p_answer_by: new Date(Date.now() + VOTE_ANSWER_MS).toISOString(),
        });
        if (error?.code === "23514") throw new HttpError(400, error.message);
        if (error) throw error;
        return { createdId: proposalId as string, ...(await list()) };
      }

      // One date: how the site suggested before #74, still answered for a
      // page loaded before then.
      const date = parseEventDate(body.date);
      if (!date) throw new HttpError(400, "That date isn't valid any more. Search again.");
      await requireMember(db, groupId, profileId);

      const { data: proposalId, error } = await db.rpc("suggest_event", {
        p_group_id: groupId,
        p_created_by: profileId,
        p_title: title,
        p_settings: body.settings,
        p_starts_at: date.start,
        p_ends_at: date.end,
      });
      // The 20-open-events limit is raised by the database with a message
      // written for people.
      if (error?.code === "23514") throw new HttpError(400, error.message);
      if (error) throw error;
      // A group of one is scheduled the moment it is suggested.
      syncCalendarsLater(proposalId);
      return await list();
    }

    case "respond": {
      const proposalId = requireString(body, "proposalId");
      const dateId = requireString(body, "dateId");
      const response = body.response;
      if (response !== "accepted" && response !== "declined") {
        throw new HttpError(400, "response must be accepted or declined");
      }

      // A decline brings the next date, or null when the search found none.
      let next: { start: string; end: string } | null = null;
      if (response === "declined" && body.next != null) {
        next = parseEventDate(body.next);
        if (!next) throw new HttpError(400, "The replacement date isn't valid.");
        // It has to come after the date being declined: the search runs
        // forward from the day after, never back over dates already seen.
        const { data: declined, error } = await db
          .from("event_proposal_dates")
          .select("starts_at")
          .eq("id", dateId)
          .eq("proposal_id", proposalId)
          .maybeSingle();
        if (error) throw error;
        if (!declined) throw new HttpError(404, "That event no longer exists.");
        if (Date.parse(next.start) <= Date.parse(declined.starts_at)) {
          throw new HttpError(400, "The replacement date must be after the declined one.");
        }
      }

      const { data: outcome, error } = await db.rpc("respond_to_event", {
        p_proposal_id: proposalId,
        p_date_id: dateId,
        p_profile_id: profileId,
        p_response: response,
        p_next_starts_at: next?.start ?? null,
        p_next_ends_at: next?.end ?? null,
      });
      if (error) throw error;
      if (outcome === "not_invited")
        throw new HttpError(403, "You weren't asked about that event.");
      if (outcome === "closed") {
        throw new HttpError(409, "That event is no longer waiting for answers.");
      }
      if (outcome === "stale") {
        throw new HttpError(
          409,
          "Someone else answered first and the date changed. Have a look at the new one.",
        );
      }
      // The last yes schedules it: in go the automatic adds.
      if (outcome === "accepted") syncCalendarsLater(proposalId);
      return { outcome, ...(await list()) };
    }

    case "answer": {
      // One date of a vote: accepted (can), maybe (can, rather not), declined.
      const proposalId = requireString(body, "proposalId");
      const dateId = requireString(body, "dateId");
      const response = body.response;
      if (response !== "accepted" && response !== "maybe" && response !== "declined") {
        throw new HttpError(400, "response must be accepted, maybe or declined");
      }
      const { data: outcome, error } = await db.rpc("respond_to_vote", {
        p_proposal_id: proposalId,
        p_date_id: dateId,
        p_profile_id: profileId,
        p_response: response,
      });
      if (error) throw error;
      if (outcome === "not_found") throw new HttpError(404, "That event no longer exists.");
      if (outcome === "not_invited") {
        throw new HttpError(403, "You weren't asked about that event.");
      }
      if (outcome === "not_vote" || outcome === "closed") {
        throw new HttpError(409, "That event is no longer waiting for answers.");
      }
      if (outcome === "past") throw new HttpError(409, "That date has already begun.");
      // The answer that decides it puts it into calendars; one that moves a
      // decided date ("moved", or "undecided" after a move) takes the old
      // entries out and, once decided again, puts the new date in.
      if (outcome === "scheduled" || outcome === "moved" || outcome === "undecided") {
        syncCalendarsLater(proposalId);
      }
      return { outcome, ...(await list()) };
    }

    case "choose": {
      // The suggester picks a vote's date: when every date has a decline, or
      // without waiting for the last answers.
      const proposalId = requireString(body, "proposalId");
      const dateId = requireString(body, "dateId");
      const { data: outcome, error } = await db.rpc("choose_vote_date", {
        p_proposal_id: proposalId,
        p_date_id: dateId,
        p_profile_id: profileId,
      });
      if (error) throw error;
      if (outcome === "not_found") throw new HttpError(404, "That event no longer exists.");
      if (outcome === "not_creator") {
        throw new HttpError(403, "Only the person who suggested this event can choose its date.");
      }
      if (outcome === "not_vote" || outcome === "closed") {
        throw new HttpError(409, "That event is no longer waiting for answers.");
      }
      if (outcome === "past") throw new HttpError(409, "That date has already begun.");
      syncCalendarsLater(proposalId);
      return await list();
    }

    case "cancel": {
      const proposalId = requireString(body, "proposalId");
      const { data: proposal, error } = await db
        .from("event_proposals")
        .select("created_by, status")
        .eq("id", proposalId)
        .maybeSingle();
      if (error) throw error;
      if (!proposal) throw new HttpError(404, "That event no longer exists.");
      // Only the person who suggested it can call it off; everyone else
      // answers it instead.
      if (proposal.created_by !== profileId) {
        throw new HttpError(403, "Only the person who suggested this event can cancel it.");
      }
      if (proposal.status !== "cancelled") {
        const { error: updErr } = await db
          .from("event_proposals")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", proposalId);
        if (updErr) throw updErr;
        // Out of every calendar Casy put it in.
        await unwantEverywhere(db, proposalId);
        syncCalendarsLater(proposalId);
      }
      return await list();
    }

    case "leave": {
      const proposalId = requireString(body, "proposalId");
      const { data: outcome, error } = await db.rpc("leave_event", {
        p_proposal_id: proposalId,
        p_profile_id: profileId,
      });
      if (error) throw error;
      if (outcome === "not_found") throw new HttpError(404, "That event no longer exists.");
      if (outcome === "creator") {
        throw new HttpError(403, "You suggested this event, so cancel it instead.");
      }
      if (outcome === "closed") throw new HttpError(409, "That event is no longer going ahead.");
      // "not_invited" is a second click: already gone, so the list without it
      // is the answer.
      if (outcome !== "not_invited") {
        // Out of the leaver's own calendar; if leaving scheduled the event,
        // in go everyone else's automatic adds.
        await unwantEverywhere(db, proposalId, profileId);
        syncCalendarsLater(proposalId);
      }
      return await list();
    }

    case "add-to-calendar": {
      const proposalId = requireString(body, "proposalId");
      const event = await one(proposalId);
      if (
        event.status !== "scheduled" ||
        !event.currentDate ||
        Date.parse(event.currentDate.end) <= Date.now()
      ) {
        throw new HttpError(409, "Only upcoming events everyone has accepted can be added.");
      }
      if ((await wantInCalendar(db, proposalId, profileId)) === "no_primary") {
        throw new HttpError(409, "Choose a primary calendar first.");
      }
      // Waited for, unlike the automatic adds: the button says how it went.
      await processWrites(db, encryptionKeyFromEnv(), { proposalId, profileId });
      const { events } = await list();
      const mine = events.find((e) => e.id === proposalId)?.myCalendar;
      if (mine?.state === "adding") {
        throw new HttpError(
          502,
          mine.error ?? "Couldn't reach Apple Calendar. Casy will try again within the hour.",
          { events },
        );
      }
      return { events };
    }

    case "ics": {
      // The same entry as a file, for adding by hand.
      const event = await one(requireString(body, "proposalId"));
      if (event.status !== "scheduled" || !event.currentDate) {
        throw new HttpError(409, "Only upcoming events everyone has accepted can be added.");
      }
      const ics = buildEventIcs(
        {
          id: event.id,
          title: event.title,
          groupName: event.group.name,
          others: event.invitees.filter((i) => !i.isYou).map((i) => i.name),
          kind: event.settings?.kind ?? "single",
          start: event.currentDate.start,
          end: event.currentDate.end,
        },
        langOf(req),
      );
      return { filename: eventResourceName(event.id), ics };
    }

    default:
      throw new HttpError(400, `Unknown action "${action}"`);
  }
});
