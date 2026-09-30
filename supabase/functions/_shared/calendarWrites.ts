/**
 * Putting agreed events into people's primary calendars, and taking them out
 * again when an event is cancelled (see the calendar_event_writes migration).
 *
 * Three steps, each safe to repeat:
 *
 *  - Say what should happen: wantInCalendar (an "Add to my calendar" click),
 *    queueAutoAdds (everyone with "Add automatically" on), unwantEverywhere
 *    (a cancel). These only write rows.
 *  - processWrites carries out whatever rows are left to do: it logs in to
 *    iCloud once per account, finds the calendar, and PUTs or DELETEs.
 *  - The events function runs both at once; the hourly sync runs them again
 *    for anything that failed or was missed (someone leaving a group can
 *    complete an event, for instance).
 *
 * Only iCloud calendars can be written to so far. Every write is keyed by the
 * event (eventResourceName), and iCloud is told never to overwrite, so a retry
 * never makes a second copy.
 *
 * An entry deleted by hand is noticed by the next sync of that account
 * (markGoneEntries): the row is closed and marked `gone_at`, the page offers
 * "Add it again", and "Add automatically" leaves it alone rather than fight
 * its owner.
 */
import {
  CalDavError,
  type CalDavCredentials,
  deleteEvent,
  discoverCalendars,
  putEvent,
} from "./caldav.ts";
import {
  type AgreedEvent,
  buildEventIcs,
  eventResourceName,
  eventUid,
  type IcsLang,
} from "./eventIcs.ts";
import { decryptSecret } from "./secretBox.ts";
import type { supabaseAdmin } from "./supabaseAdmin.ts";

type Db = ReturnType<typeof supabaseAdmin>;

/** Failed tries before a write is left alone; the person can still click again. */
export const MAX_ATTEMPTS = 6;
/** Rows handled per run; the rest wait for the next. */
const BATCH = 50;

/** Which rows a call is about: one event, one person, or (neither) everyone. */
export interface WriteScope {
  proposalId?: string;
  profileId?: string;
}

export interface WriteRow {
  proposal_id: string;
  profile_id: string;
  source_id: string | null;
  wanted: boolean;
  added: boolean;
  attempts: number;
}

/**
 * What to do with one row, given the event as it is now:
 *
 * - "put":    add it to the calendar
 * - "delete": take it out of the calendar
 * - "forget": nothing can or should be written any more (the event was
 *             cancelled or is over before it was added, or the calendar is
 *             gone), so the row is closed without touching any calendar
 * - "none":   nothing left to do
 */
export function nextStep(
  row: Pick<WriteRow, "wanted" | "added" | "source_id">,
  event: { status: string; end: string | null } | null,
  now: number,
): "put" | "delete" | "forget" | "none" {
  if (row.wanted === row.added) return "none";
  if (row.wanted) {
    const addable =
      !!event && event.status === "scheduled" && !!event.end && Date.parse(event.end) > now;
    return addable && row.source_id ? "put" : "forget";
  }
  return row.source_id ? "delete" : "forget";
}

/** The rows a scope covers that still have work to do. */
function todoQuery(db: Db, scope: WriteScope) {
  let q = db
    .from("calendar_event_writes")
    .select("proposal_id, profile_id, source_id, wanted, added, attempts")
    .or("and(wanted.eq.true,added.eq.false),and(wanted.eq.false,added.eq.true)")
    .lt("attempts", MAX_ATTEMPTS)
    .order("updated_at", { ascending: true })
    .limit(BATCH);
  if (scope.proposalId) q = q.eq("proposal_id", scope.proposalId);
  if (scope.profileId) q = q.eq("profile_id", scope.profileId);
  return q;
}

/**
 * Ask for an event to be in someone's primary calendar. Answers "no_primary"
 * when they haven't chosen one, and changes nothing then.
 */
export async function wantInCalendar(
  db: Db,
  proposalId: string,
  profileId: string,
): Promise<"queued" | "no_primary"> {
  const [{ data: primary, error: primaryErr }, { data: existing, error: existingErr }] =
    await Promise.all([
      db.from("primary_calendars").select("source_id").eq("profile_id", profileId).maybeSingle(),
      db
        .from("calendar_event_writes")
        .select("source_id, added")
        .eq("proposal_id", proposalId)
        .eq("profile_id", profileId)
        .maybeSingle(),
    ]);
  if (primaryErr) throw primaryErr;
  if (existingErr) throw existingErr;
  if (!primary) return "no_primary";

  const { error } = await db.from("calendar_event_writes").upsert(
    {
      proposal_id: proposalId,
      profile_id: profileId,
      // Already in a calendar: it stays there. Otherwise the primary one.
      source_id: existing?.added ? existing.source_id : primary.source_id,
      wanted: true,
      attempts: 0,
      last_error: null,
      gone_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "proposal_id,profile_id" },
  );
  if (error) throw error;
  return "queued";
}

/** An added entry, as markGoneEntries checks it. */
export interface AddedEntry {
  proposal_id: string;
  /** When the row last changed: an entry added after the check began is skipped. */
  updated_at: string;
  status: string;
  /** The event's current date; null if it has none. */
  start: string | null;
  end: string | null;
}

/**
 * The events whose entry is missing from an account that was just read in
 * full: scheduled, inside the window that was read, added before the read
 * began, and with no event carrying its UID anywhere in the account.
 */
export function missingEntries(
  entries: AddedEntry[],
  seenUids: ReadonlySet<string>,
  readStartedAt: Date,
  windowStart: Date,
  windowEnd: Date,
): string[] {
  return entries
    .filter(
      (e) =>
        e.status === "scheduled" &&
        !!e.start &&
        !!e.end &&
        Date.parse(e.updated_at) < readStartedAt.getTime() &&
        // Only what the read could have seen: it overlaps the window.
        Date.parse(e.start) < windowEnd.getTime() &&
        Date.parse(e.end) > windowStart.getTime() &&
        !seenUids.has(eventUid(e.proposal_id)),
    )
    .map((e) => e.proposal_id);
}

/**
 * After an iCloud account was read in full (every calendar, so nothing is
 * missing just because a calendar failed to load): close the rows whose
 * entry is no longer there, which is what its owner deleting it by hand
 * looks like. Returns how many were closed.
 */
export async function markGoneEntries(
  db: Db,
  connectionId: string,
  seenUids: ReadonlySet<string>,
  readStartedAt: Date,
  windowStart: Date,
  windowEnd: Date,
): Promise<number> {
  const { data, error } = await db
    .from("calendar_event_writes")
    .select(
      "proposal_id, profile_id, updated_at, calendar_sources!inner(connection_id), " +
        "event_proposals!inner(status, event_proposal_dates(starts_at, ends_at, declined_at, created_at))",
    )
    .eq("added", true)
    .eq("wanted", true)
    .eq("calendar_sources.connection_id", connectionId);
  if (error) throw error;

  type Row = {
    proposal_id: string;
    profile_id: string;
    updated_at: string;
    event_proposals: {
      status: string;
      event_proposal_dates: {
        starts_at: string;
        ends_at: string;
        declined_at: string | null;
        created_at: string;
      }[];
    };
  };
  const rows = (data ?? []) as unknown as Row[];
  const entries = rows.map((r) => {
    const current = r.event_proposals.event_proposal_dates
      .filter((d) => d.declined_at === null)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
    return {
      proposal_id: r.proposal_id,
      updated_at: r.updated_at,
      status: r.event_proposals.status,
      start: current?.starts_at ?? null,
      end: current?.ends_at ?? null,
    };
  });
  const missing = new Set(missingEntries(entries, seenUids, readStartedAt, windowStart, windowEnd));

  let closed = 0;
  for (const r of rows.filter((r) => missing.has(r.proposal_id))) {
    const now = new Date().toISOString();
    const { data: updated, error: updErr } = await db
      .from("calendar_event_writes")
      .update({
        wanted: false,
        added: false,
        gone_at: now,
        attempts: 0,
        last_error: null,
        updated_at: now,
      })
      .eq("proposal_id", r.proposal_id)
      .eq("profile_id", r.profile_id)
      // Unless it changed while the account was being read.
      .eq("added", true)
      .eq("wanted", true)
      .lt("updated_at", readStartedAt.toISOString())
      .select("proposal_id");
    if (updErr) throw updErr;
    closed += (updated ?? []).length;
  }
  return closed;
}

/** A cancelled event: take it out of every calendar Casy put it in. */
export async function unwantEverywhere(
  db: Db,
  proposalId: string,
  profileId?: string,
): Promise<void> {
  let query = db
    .from("calendar_event_writes")
    .update({ wanted: false, attempts: 0, last_error: null, updated_at: new Date().toISOString() })
    .eq("proposal_id", proposalId)
    .eq("wanted", true);
  // Only one person's entry, when they leave the event.
  if (profileId) query = query.eq("profile_id", profileId);
  const { error } = await query;
  if (error) throw error;
}

/**
 * Queue every scheduled, upcoming event for the people in `scope` who have
 * "Add automatically" on and don't have it queued or added already. Returns
 * how many were queued.
 */
export async function queueAutoAdds(db: Db, scope: WriteScope, now = Date.now()): Promise<number> {
  let primaries = db.from("primary_calendars").select("profile_id, source_id").eq("auto_add", true);
  if (scope.profileId) primaries = primaries.eq("profile_id", scope.profileId);
  const { data: auto, error: autoErr } = await primaries;
  if (autoErr) throw autoErr;
  if (!auto || auto.length === 0) return 0;
  const sourceOf = new Map<string, string>(
    auto.map((p: { profile_id: string; source_id: string }) => [p.profile_id, p.source_id]),
  );

  let invited = db
    .from("event_invitees")
    .select(
      "proposal_id, profile_id, event_proposals!inner(status, event_proposal_dates(ends_at, declined_at, created_at))",
    )
    .in("profile_id", [...sourceOf.keys()])
    .eq("event_proposals.status", "scheduled");
  if (scope.proposalId) invited = invited.eq("proposal_id", scope.proposalId);
  const { data: invites, error: invitesErr } = await invited;
  if (invitesErr) throw invitesErr;

  type Invite = {
    proposal_id: string;
    profile_id: string;
    event_proposals: {
      event_proposal_dates: { ends_at: string; declined_at: string | null; created_at: string }[];
    };
  };
  // Upcoming only: the current date (newest not declined) hasn't ended.
  const upcoming = ((invites ?? []) as unknown as Invite[]).filter((i) => {
    const current = i.event_proposals.event_proposal_dates
      .filter((d) => d.declined_at === null)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
    return !!current && Date.parse(current.ends_at) > now;
  });
  if (upcoming.length === 0) return 0;

  // Anything already queued, added, or taken out again is left as it is.
  const { data: known, error: knownErr } = await db
    .from("calendar_event_writes")
    .select("proposal_id, profile_id")
    .in("proposal_id", [...new Set(upcoming.map((i) => i.proposal_id))]);
  if (knownErr) throw knownErr;
  const seen = new Set(
    (known ?? []).map(
      (k: { proposal_id: string; profile_id: string }) => `${k.proposal_id}:${k.profile_id}`,
    ),
  );

  const rows = upcoming
    .filter((i) => !seen.has(`${i.proposal_id}:${i.profile_id}`))
    .map((i) => ({
      proposal_id: i.proposal_id,
      profile_id: i.profile_id,
      source_id: sourceOf.get(i.profile_id),
      wanted: true,
    }));
  if (rows.length === 0) return 0;
  // ignoreDuplicates: a click or another run may have queued one meanwhile.
  const { error } = await db
    .from("calendar_event_writes")
    .upsert(rows, { onConflict: "proposal_id,profile_id", ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
}

/** What one account needs to be written to: its login and its calendars. */
interface Account {
  creds: CalDavCredentials;
  calendarUrlById: Map<string, string>;
}

/**
 * Carry out the rows in `scope` that still have work to do. Never throws for
 * one row: a failure is counted and its reason stored on the row, for the
 * page and the next try. Stops starting new rows after `budgetMs`.
 */
export async function processWrites(
  db: Db,
  key: string,
  scope: WriteScope,
  { now = Date.now(), budgetMs = 60_000 }: { now?: number; budgetMs?: number } = {},
): Promise<{ done: number; failed: number }> {
  const { data: todo, error: todoErr } = await todoQuery(db, scope);
  if (todoErr) throw todoErr;
  const rows = (todo ?? []) as WriteRow[];
  if (rows.length === 0) return { done: 0, failed: 0 };

  const proposalIds = [...new Set(rows.map((r) => r.proposal_id))];
  const sourceIds = [...new Set(rows.map((r) => r.source_id).filter((id): id is string => !!id))];
  const profileIds = [...new Set(rows.map((r) => r.profile_id))];

  const [proposals, sources, langs, invitees] = await Promise.all([
    db
      .from("event_proposals")
      .select(
        "id, title, status, settings, friend_groups(name), event_proposal_dates(starts_at, ends_at, declined_at, created_at)",
      )
      .in("id", proposalIds),
    sourceIds.length > 0
      ? db
          .from("calendar_sources")
          .select("id, external_calendar_id, calendar_connections!inner(id, provider)")
          .in("id", sourceIds)
      : Promise.resolve({ data: [], error: null }),
    db.from("primary_calendars").select("profile_id, lang").in("profile_id", profileIds),
    db.from("event_invitees").select("proposal_id, profile_id").in("proposal_id", proposalIds),
  ]);
  for (const r of [proposals, sources, langs, invitees]) if (r.error) throw r.error;

  type ProposalRow = {
    id: string;
    title: string;
    status: string;
    settings: { kind?: string } | null;
    friend_groups: { name: string } | null;
    event_proposal_dates: {
      starts_at: string;
      ends_at: string;
      declined_at: string | null;
      created_at: string;
    }[];
  };
  const proposalById = new Map(
    ((proposals.data ?? []) as unknown as ProposalRow[]).map((p) => {
      const current = p.event_proposal_dates
        .filter((d) => d.declined_at === null)
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
      return [p.id, { ...p, current: current ?? null }];
    }),
  );
  type SourceRow = {
    id: string;
    external_calendar_id: string;
    calendar_connections: { id: string; provider: string };
  };
  const sourceById = new Map(
    ((sources.data ?? []) as unknown as SourceRow[]).map((s) => [s.id, s]),
  );
  const langOf = new Map(
    ((langs.data ?? []) as { profile_id: string; lang: IcsLang }[]).map((l) => [
      l.profile_id,
      l.lang,
    ]),
  );

  // Everyone's names, for "Agreed in Casy with Anna and Bo".
  const inviteeRows = (invitees.data ?? []) as { proposal_id: string; profile_id: string }[];
  const { data: names, error: namesErr } = await db
    .from("profiles")
    .select("id, display_name")
    .in("id", [...new Set(inviteeRows.map((i) => i.profile_id))]);
  if (namesErr) throw namesErr;
  const nameById = new Map(
    (names ?? []).map((n: { id: string; display_name: string | null }) => [n.id, n.display_name]),
  );

  // One login and calendar listing per account, however many rows it has.
  const accounts = new Map<string, Promise<Account>>();
  const accountFor = (connectionId: string) => {
    let account = accounts.get(connectionId);
    if (!account) {
      account = openAccount(db, connectionId, key);
      accounts.set(connectionId, account);
    }
    return account;
  };

  const started = Date.now();
  let done = 0;
  let failed = 0;
  for (const row of rows) {
    if (Date.now() - started > budgetMs) break;
    const proposal = proposalById.get(row.proposal_id) ?? null;
    const source = row.source_id ? (sourceById.get(row.source_id) ?? null) : null;
    const step = nextStep(
      // A calendar that is no longer iCloud's can't be written: treat it as gone.
      {
        ...row,
        source_id: source?.calendar_connections.provider === "apple" ? row.source_id : null,
      },
      proposal ? { status: proposal.status, end: proposal.current?.ends_at ?? null } : null,
      now,
    );
    try {
      if (step === "none") continue;
      if (step === "forget") {
        // Close the row: wanted and added both say "not in the calendar".
        const { error } = await db
          .from("calendar_event_writes")
          .update({ wanted: false, added: false, updated_at: new Date().toISOString() })
          .eq("proposal_id", row.proposal_id)
          .eq("profile_id", row.profile_id)
          // Only as it was read: a write that finished meanwhile must not be
          // forgotten, or a cancel could never take it out again.
          .eq("wanted", row.wanted)
          .eq("added", row.added);
        if (error) throw error;
        done++;
        continue;
      }

      const account = await accountFor(source!.calendar_connections.id);
      const calendarUrl = account.calendarUrlById.get(source!.external_calendar_id);
      if (!calendarUrl) throw new CalDavError("That calendar is no longer in the iCloud account.");
      const resource = eventResourceName(row.proposal_id);

      if (step === "put") {
        const others = inviteeRows
          .filter((i) => i.proposal_id === row.proposal_id && i.profile_id !== row.profile_id)
          .map((i) => nameById.get(i.profile_id) ?? null)
          .filter((n): n is string => !!n)
          .sort((a, b) => a.localeCompare(b));
        const event: AgreedEvent = {
          id: proposal!.id,
          title: proposal!.title,
          groupName: proposal!.friend_groups?.name ?? "Casy",
          others,
          kind: proposal!.settings?.kind ?? "single",
          start: proposal!.current!.starts_at,
          end: proposal!.current!.ends_at,
        };
        await putEvent(
          account.creds,
          calendarUrl,
          resource,
          buildEventIcs(event, langOf.get(row.profile_id) ?? "da"),
        );
        const { error } = await db
          .from("calendar_event_writes")
          .update({
            added: true,
            attempts: 0,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("proposal_id", row.proposal_id)
          .eq("profile_id", row.profile_id);
        if (error) throw error;
      } else {
        await deleteEvent(account.creds, calendarUrl, resource);
        const { error } = await db
          .from("calendar_event_writes")
          .update({
            added: false,
            attempts: 0,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("proposal_id", row.proposal_id)
          .eq("profile_id", row.profile_id);
        if (error) throw error;
      }
      done++;
    } catch (err) {
      failed++;
      console.error("calendar write failed", step, row.proposal_id, err);
      // Only messages written for people are stored; anything else is generic.
      const message =
        err instanceof CalDavError
          ? err.message
          : "Couldn't reach iCloud. Casy will try again within the hour.";
      const { error } = await db
        .from("calendar_event_writes")
        .update({
          attempts: row.attempts + 1,
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("proposal_id", row.proposal_id)
        .eq("profile_id", row.profile_id);
      if (error) console.error("could not record the failed calendar write", error);
    }
  }
  return { done, failed };
}

/** Log in to one iCloud account and list its calendars. */
async function openAccount(db: Db, connectionId: string, key: string): Promise<Account> {
  const { data: secrets, error } = await db
    .from("calendar_secrets")
    .select("caldav_username, caldav_password")
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (error) throw error;
  if (!secrets?.caldav_username || !secrets.caldav_password) {
    throw new CalDavError("Reconnect your iCloud account on your profile.");
  }
  const creds = {
    username: secrets.caldav_username,
    password: await decryptSecret(secrets.caldav_password, key),
  };
  const calendars = await discoverCalendars(creds);
  return { creds, calendarUrlById: new Map(calendars.map((c) => [c.id, c.url])) };
}
