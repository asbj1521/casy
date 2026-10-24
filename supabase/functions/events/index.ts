/**
 * Suggested events: suggest a date to your group, answer one suggested to
 * you, cancel one you suggested or change its place and note (edit, #84),
 * leave one someone else suggested, and list everything you're part of.
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
  isEventSettings,
  parseCandidateDates,
  parseEventDate,
  voteAnswerMs,
} from "../_shared/events.ts";
import { displayNameFor, requireMember } from "../_shared/groups.ts";
import { afterResponse, HttpError, requireString, serve } from "../_shared/http.ts";
import { langOf } from "../_shared/i18n.ts";
import { groupMemberIds, MAX_RANKED_DATES, scoreDates } from "../_shared/rankDates.ts";
import { cleanProfile } from "../_shared/profileAi.ts";
import { encryptionKeyFromEnv } from "../_shared/secretBox.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { listEvents } from "./list.ts";
import { invitedMembers, eventDetails, storeMatchScores } from "./suggest.ts";

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
      const details = eventDetails(body);

      // The dates of a vote (#74); a single `date`, as the site suggested before
      // #74, is turned away. Everyone, the suggester included,
      // answers them; nothing is scheduled until then. On a phone the
      // suggester's answers come with the dates (#101).
      const dates = parseCandidateDates(body.dates);
      if (!dates) throw new HttpError(400, "Those dates aren't valid any more. Search again.");
      // How long everyone has to answer (#99): 1 to 7 days, 3 if not chosen.
      const answerMs = voteAnswerMs(body.answerDays);
      if (answerMs === null) throw new HttpError(400, "Choose 1 to 7 days to answer in.");
      await requireMember(db, groupId, profileId);
      const members = await invitedMembers(db, groupId, profileId, body.settings);
      const { data: proposalId, error } = await db.rpc("suggest_vote_event", {
        p_group_id: groupId,
        p_created_by: profileId,
        p_title: title,
        p_settings: body.settings,
        p_dates: dates,
        p_answer_by: new Date(Date.now() + answerMs).toISOString(),
        p_place: details.place,
        p_note: details.note,
        p_members: members,
      });
      if (error?.code === "23514") throw new HttpError(400, error.message);
      if (error) throw error;
      // What the event is likely to cause (#113), as the scheduler fetched
      // it: kept with the event for everyone's own warnings. Never worth
      // failing the suggestion over.
      const impact = body.impact === undefined ? null : cleanProfile(body.impact);
      if (impact) {
        const { error: impactError } = await db
          .from("event_proposals")
          .update({ impact })
          .eq("id", proposalId as string);
        if (impactError) console.error("events: couldn't store the event's profile", impactError);
      }
      // How well each date suits the group by their important events (#119),
      // kept with it so everyone sees the same number. Never worth failing
      // the suggestion over either.
      try {
        await storeMatchScores(
          db,
          proposalId as string,
          members ?? (await groupMemberIds(db, groupId)),
          impact,
          body.settings,
        );
      } catch (scoreError) {
        console.error("events: couldn't score the vote's dates", scoreError);
      }
      // With the suggester's answers (#101) it may be settled already: a
      // vote only they had to answer goes straight into calendars.
      if (dates.some((d) => d.answer)) syncCalendarsLater(proposalId as string);
      return { createdId: proposalId as string, ...(await list()) };
    }

    // How well each of these dates would suit the group by the members'
    // important events (#119): one score per date, in order, never whose
    // facts cost what. The scheduler asks before it picks a vote's dates.
    case "rank-dates": {
      const groupId = requireString(body, "groupId");
      if (!isEventSettings(body.settings)) {
        throw new HttpError(400, "Those event settings aren't valid.");
      }
      if (!Array.isArray(body.dates) || body.dates.length > MAX_RANKED_DATES) {
        throw new HttpError(400, "Those dates aren't valid any more. Search again.");
      }
      const dates = body.dates.map((d) => parseEventDate(d));
      if (dates.some((d) => d === null)) {
        throw new HttpError(400, "Those dates aren't valid any more. Search again.");
      }
      await requireMember(db, groupId, profileId);
      const members =
        (await invitedMembers(db, groupId, profileId, body.settings)) ??
        (await groupMemberIds(db, groupId));
      const profile = body.profile == null ? null : cleanProfile(body.profile);
      return await scoreDates(db, {
        members,
        profile,
        single: (body.settings as { kind?: string }).kind === "single",
        dates: dates as { start: string; end: string }[],
      });
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

    case "edit": {
      // The suggester changes the place and the note (#84); empty clears one.
      // Entries already in people's calendars are rewritten with them.
      const proposalId = requireString(body, "proposalId");
      const details = eventDetails(body);
      const { data: outcome, error } = await db.rpc("edit_event_details", {
        p_proposal_id: proposalId,
        p_profile_id: profileId,
        p_place: details.place,
        p_note: details.note,
      });
      if (error) throw error;
      if (outcome === "not_found") throw new HttpError(404, "That event no longer exists.");
      if (outcome === "not_creator") {
        throw new HttpError(403, "Only the person who suggested this event can change it.");
      }
      if (outcome === "closed") throw new HttpError(409, "That event has been cancelled.");
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
      // A phone calendar can't be waited for: the app adds it when it runs.
      await processWrites(db, encryptionKeyFromEnv(), { proposalId, profileId });
      const { events } = await list();
      const mine = events.find((e) => e.id === proposalId)?.myCalendar;
      if (mine?.state === "adding" && !mine.onPhone) {
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
          place: event.place,
          note: event.note,
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
