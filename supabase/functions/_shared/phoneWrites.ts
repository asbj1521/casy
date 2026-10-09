/**
 * Agreed events in a phone's own calendar (#105). The server can't reach a
 * phone, so the iPhone app asks for its work (phoneWork: what to add, change
 * or take out of this phone's calendars) and carries it out with EventKit,
 * then says how it went (applyPhoneReports). The rows are the same
 * calendar_event_writes the server's own worker keeps for iCloud
 * (calendarWrites.ts), and step for step the same decisions (nextStep), so
 * cancelling, moved dates, Add automatically and entries deleted by hand all
 * behave as they do there.
 *
 * Each entry carries a link back to its event, which is also how the app
 * finds its own entry again if iOS ever changes the entry's id.
 */
import {
  forgetMoved,
  loadWriteContext,
  MAX_ATTEMPTS,
  nextStep,
  TODO_FILTER,
  type WriteRow,
} from "./calendarWrites.ts";
import { type AgreedEvent, eventDescription, eventSummary, localDate } from "./eventIcs.ts";
import { HttpError, type Body } from "./http.ts";
import type { Lang } from "./i18n.ts";
import type { Db } from "./supabaseAdmin.ts";

/** Rows handed to the phone per ask; the rest come on the next. */
const BATCH = 50;
/** Entries the phone checks are still there per ask. */
const CHECK_LIMIT = 200;
/** What the page shows for a write the phone couldn't do. */
export const PHONE_WRITE_FAILED =
  "Couldn't add it to the phone's calendar. Casy will try again next time the app opens.";

/** What the phone writes: the same words as an iCloud entry (eventIcs.ts). */
export interface PhoneEntry {
  title: string;
  location: string | null;
  notes: string;
  allDay: boolean;
  /** Timed events: ISO instants. */
  start: string;
  end: string;
  /** Whole-day events: Danish dates, end exclusive ("2026-10-12"). */
  startDay?: string;
  endDay?: string;
}

export type PhoneTask =
  | { op: "add"; proposalId: string; calendarId: string; url: string; entry: PhoneEntry }
  | {
      op: "update";
      proposalId: string;
      calendarId: string;
      eventId: string | null;
      url: string;
      entry: PhoneEntry;
    }
  | { op: "remove"; proposalId: string; eventId: string | null; url: string };

/** The link an entry carries back to its event, also how the app finds it again. */
export function eventUrl(proposalId: string): string {
  return `https://casy.app/events/${proposalId}`;
}

const dashed = (yyyymmdd: string) =>
  `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;

/** The entry for an event in the reader's language: a trip as whole Danish days. */
export function phoneEntry(event: AgreedEvent, lang: Lang): PhoneEntry {
  const allDay = event.kind === "vacation";
  return {
    title: eventSummary(event, lang),
    location: event.place ?? null,
    notes: eventDescription(event, lang),
    allDay,
    start: event.start,
    end: event.end,
    ...(allDay
      ? { startDay: dashed(localDate(event.start)), endDay: dashed(localDate(event.end)) }
      : {}),
  };
}

export type PhoneOutcome = "added" | "updated" | "removed" | "gone" | "failed";

export interface PhoneReport {
  proposalId: string;
  outcome: PhoneOutcome;
  /** The entry's id on the phone, after adding or changing it. */
  eventId: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OUTCOMES: readonly PhoneOutcome[] = ["added", "updated", "removed", "gone", "failed"];
const MAX_REPORTS = 300;

/** The phone's reports, checked like any request body. */
export function parseReports(body: Body): PhoneReport[] {
  if (!Array.isArray(body.reports)) throw new HttpError(400, "reports must be a list");
  if (body.reports.length > MAX_REPORTS) throw new HttpError(400, "Too many reports");
  return body.reports.map((raw: unknown) => {
    const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    if (typeof r.proposalId !== "string" || !UUID.test(r.proposalId)) {
      throw new HttpError(400, "Each report needs an event id");
    }
    if (!OUTCOMES.includes(r.outcome as PhoneOutcome)) {
      throw new HttpError(400, "Each report needs an outcome");
    }
    const eventId =
      typeof r.eventId === "string" && r.eventId.length > 0 && r.eventId.length <= 512
        ? r.eventId
        : null;
    return { proposalId: r.proposalId.toLowerCase(), outcome: r.outcome as PhoneOutcome, eventId };
  });
}

type ReportRow = Pick<WriteRow, "wanted" | "added" | "requeue" | "attempts"> & {
  device_event_id: string | null;
};

/**
 * What a report changes on its row. What the phone did is the truth, so it is
 * recorded even if the row changed meanwhile (a cancel while it was adding):
 * the next ask then hands out whatever is left to do.
 */
export function reportChange(
  report: PhoneReport,
  row: ReportRow,
  now: string,
): { kind: "update"; values: Record<string, unknown> } | { kind: "forgetMoved" } {
  const settled = { attempts: 0, last_error: null, updated_at: now };
  switch (report.outcome) {
    case "added":
      return {
        kind: "update",
        values: {
          ...settled,
          added: true,
          refresh: false,
          gone_at: null,
          device_event_id: report.eventId,
        },
      };
    case "updated":
      return {
        kind: "update",
        values: {
          ...settled,
          refresh: false,
          device_event_id: report.eventId ?? row.device_event_id,
        },
      };
    case "gone":
      // Missing while it should be there: its owner deleted it by hand, so it
      // is left out from now on (as markGoneEntries does for iCloud).
      if (row.wanted && !row.requeue) {
        return {
          kind: "update",
          values: {
            ...settled,
            wanted: false,
            added: false,
            refresh: false,
            gone_at: now,
            device_event_id: null,
          },
        };
      }
      // Missing while being taken out: as good as taken out.
      return removed(row, settled);
    case "removed":
      return removed(row, settled);
    case "failed":
      return {
        kind: "update",
        values: { attempts: row.attempts + 1, last_error: PHONE_WRITE_FAILED, updated_at: now },
      };
  }
}

function removed(
  row: ReportRow,
  settled: Record<string, unknown>,
): { kind: "update"; values: Record<string, unknown> } | { kind: "forgetMoved" } {
  if (row.requeue) return { kind: "forgetMoved" };
  return {
    kind: "update",
    values: { ...settled, added: false, refresh: false, device_event_id: null },
  };
}

/** One phone connection's calendars: their ids here and on the phone. */
async function phoneSources(db: Db, connectionId: string) {
  const { data, error } = await db
    .from("calendar_sources")
    .select("id, external_calendar_id")
    .eq("connection_id", connectionId);
  if (error) throw error;
  return (data ?? []) as { id: string; external_calendar_id: string }[];
}

/**
 * What this phone should do now: entries to add, change or take out, and the
 * entries it added that it should check are still there. Rows with nothing
 * to write any more (the event cancelled before it went in, a change to an
 * event that is over) are settled here and never reach the phone.
 */
export async function phoneWork(
  db: Db,
  connectionId: string,
  now = Date.now(),
): Promise<{ tasks: PhoneTask[]; check: { proposalId: string; eventId: string | null }[] }> {
  const sources = await phoneSources(db, connectionId);
  if (sources.length === 0) return { tasks: [], check: [] };
  const sourceIds = sources.map((s) => s.id);
  const externalOf = new Map(sources.map((s) => [s.id, s.external_calendar_id]));

  const columns =
    "proposal_id, profile_id, source_id, wanted, added, attempts, requeue, refresh, device_event_id";
  const [todo, added] = await Promise.all([
    db
      .from("calendar_event_writes")
      .select(columns)
      .in("source_id", sourceIds)
      .or(TODO_FILTER)
      .lt("attempts", MAX_ATTEMPTS)
      .order("updated_at", { ascending: true })
      .limit(BATCH),
    db
      .from("calendar_event_writes")
      .select(columns)
      .in("source_id", sourceIds)
      .eq("wanted", true)
      .eq("added", true)
      .limit(CHECK_LIMIT),
  ]);
  if (todo.error) throw todo.error;
  if (added.error) throw added.error;
  type Row = WriteRow & { device_event_id: string | null };
  const todoRows = (todo.data ?? []) as Row[];
  const addedRows = (added.data ?? []) as Row[];
  if (todoRows.length === 0 && addedRows.length === 0) return { tasks: [], check: [] };

  const { proposalById, langOf, agreedEventFor } = await loadWriteContext(db, [
    ...todoRows,
    ...addedRows,
  ]);
  const eventOf = (proposalId: string) => {
    const p = proposalById.get(proposalId);
    return p ? { status: p.status, end: p.current?.ends_at ?? null } : null;
  };

  const tasks: PhoneTask[] = [];
  for (const row of todoRows) {
    const step = nextStep(row, eventOf(row.proposal_id), now);
    const url = eventUrl(row.proposal_id);
    const calendarId = row.source_id ? externalOf.get(row.source_id) : undefined;
    const entry = () =>
      phoneEntry(agreedEventFor(row), langOf.get(row.profile_id) ?? ("da" as Lang));
    if (step === "put" && calendarId) {
      tasks.push({ op: "add", proposalId: row.proposal_id, calendarId, url, entry: entry() });
    } else if (step === "replace" && calendarId) {
      tasks.push({
        op: "update",
        proposalId: row.proposal_id,
        calendarId,
        eventId: row.device_event_id,
        url,
        entry: entry(),
      });
    } else if (step === "delete") {
      tasks.push({ op: "remove", proposalId: row.proposal_id, eventId: row.device_event_id, url });
    } else if (step === "settle") {
      await updateRow(db, row, { refresh: false, updated_at: new Date().toISOString() });
    } else if (step === "forget") {
      if (row.requeue) await forgetMoved(db, row);
      else {
        // Only as it was read, as the server's worker does.
        const { error } = await db
          .from("calendar_event_writes")
          .update({ wanted: false, added: false, updated_at: new Date().toISOString() })
          .eq("proposal_id", row.proposal_id)
          .eq("profile_id", row.profile_id)
          .eq("wanted", row.wanted)
          .eq("added", row.added);
        if (error) throw error;
      }
    }
  }

  // Entries that should be there, for an event still to come: the phone says
  // which are missing (deleted by hand).
  const check = addedRows
    .filter((row) => {
      const event = eventOf(row.proposal_id);
      return event?.status === "scheduled" && !!event.end && Date.parse(event.end) > now;
    })
    .map((row) => ({ proposalId: row.proposal_id, eventId: row.device_event_id }));

  return { tasks, check };
}

async function updateRow(
  db: Db,
  row: Pick<WriteRow, "proposal_id" | "profile_id">,
  values: Record<string, unknown>,
): Promise<void> {
  const { error } = await db
    .from("calendar_event_writes")
    .update(values)
    .eq("proposal_id", row.proposal_id)
    .eq("profile_id", row.profile_id);
  if (error) throw error;
}

/** Record what the phone did. Reports for rows outside its calendars are ignored. */
export async function applyPhoneReports(
  db: Db,
  connectionId: string,
  reports: PhoneReport[],
): Promise<number> {
  if (reports.length === 0) return 0;
  const sourceIds = (await phoneSources(db, connectionId)).map((s) => s.id);
  if (sourceIds.length === 0) return 0;
  const { data, error } = await db
    .from("calendar_event_writes")
    .select("proposal_id, profile_id, wanted, added, requeue, attempts, device_event_id")
    .in("source_id", sourceIds)
    .in("proposal_id", [...new Set(reports.map((r) => r.proposalId))]);
  if (error) throw error;
  type Row = ReportRow & { proposal_id: string; profile_id: string };
  const rowOf = new Map(((data ?? []) as Row[]).map((r) => [r.proposal_id, r]));

  let applied = 0;
  for (const report of reports) {
    const row = rowOf.get(report.proposalId);
    if (!row) continue;
    const change = reportChange(report, row, new Date().toISOString());
    if (change.kind === "forgetMoved") await forgetMoved(db, row);
    else await updateRow(db, row, change.values);
    applied++;
  }
  return applied;
}
