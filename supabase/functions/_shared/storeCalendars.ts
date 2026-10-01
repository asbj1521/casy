/**
 * Saving a newly connected account: the connection, its secret, its calendars
 * and their busy blocks. Everything is fetched and parsed *before* any of this
 * runs, so a bad link or a wrong password never leaves rows behind.
 *
 * ICS links and iCloud save it all at once (storeCalendars), and a failure
 * removes the half-made connection again. Google and Outlook record the
 * attempt first (createConnection) and fill it in once the provider has
 * answered (fillConnection), so a failed or repeated callback has a row to
 * show or to be compared against (oauth.ts).
 */
import type { RawBusyInterval } from "./intervals.ts";
import type { Db } from "./supabaseAdmin.ts";
import type { Provider } from "./sync.ts";

const BUSY_INSERT_CHUNK = 500;

/** One calendar inside the account, with its busy blocks already computed. */
export interface CalendarToStore {
  /** The provider's own id for this calendar; unique within the connection. */
  externalId: string;
  displayName: string | null;
  /** Casy may add events to it; left out (all but iCloud) means no. */
  writable?: boolean;
  intervals: RawBusyInterval[];
}

export interface AccountToStore {
  /** What the profile page shows for the account (a link's name, an email). */
  accountLabel: string | null;
  /** Columns of calendar_secrets to fill, already encrypted by the caller. */
  secrets: Record<string, string>;
  calendars: CalendarToStore[];
}

/** Saving failed; the message is for the logs, not for the user. */
export class StoreError extends Error {}

/** A new connection, pending until its calendars are stored. */
export async function createConnection(
  db: Db,
  profileId: string,
  provider: Provider,
): Promise<{ id: string; created_at: string }> {
  const { data, error } = await db
    .from("calendar_connections")
    .insert({ profile_id: profileId, provider, status: "pending" })
    .select("id, created_at")
    .single();
  if (error || !data) {
    throw new StoreError(`Failed to create calendar_connections row: ${error?.message}`);
  }
  return data;
}

/** Store the account's secret, calendars and busy blocks, and mark it connected. */
export async function fillConnection(
  db: Db,
  connectionId: string,
  account: AccountToStore,
): Promise<void> {
  const { error: secretErr } = await db
    .from("calendar_secrets")
    .insert({ connection_id: connectionId, ...account.secrets });
  if (secretErr) throw secretErr;

  if (account.calendars.length > 0) {
    const { data: sources, error: sourcesErr } = await db
      .from("calendar_sources")
      .insert(
        account.calendars.map((c) => ({
          connection_id: connectionId,
          external_calendar_id: c.externalId,
          display_name: c.displayName,
          writable: c.writable ?? false,
        })),
      )
      .select("id, external_calendar_id");
    if (sourcesErr || !sources) throw sourcesErr ?? new Error("No calendar_sources returned");

    const sourceIdOf = new Map(sources.map((s) => [s.external_calendar_id, s.id]));
    const busyRows = account.calendars.flatMap((c) => {
      const sourceId = sourceIdOf.get(c.externalId);
      return sourceId
        ? c.intervals.map((iv) => ({ source_id: sourceId, start_at: iv.start, end_at: iv.end }))
        : [];
    });
    for (let i = 0; i < busyRows.length; i += BUSY_INSERT_CHUNK) {
      const { error: busyErr } = await db
        .from("calendar_busy_cache")
        .insert(busyRows.slice(i, i + BUSY_INSERT_CHUNK));
      if (busyErr) throw busyErr;
    }
  }

  const { error: updateErr } = await db
    .from("calendar_connections")
    .update({
      status: "connected",
      account_label: account.accountLabel,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", connectionId);
  if (updateErr) throw updateErr;
}

/**
 * Store a whole account and return its new connection id. Throws StoreError,
 * after removing whatever was saved, if anything goes wrong.
 */
export async function storeCalendars(
  db: Db,
  input: AccountToStore & { profileId: string; provider: "ics" | "apple" },
): Promise<{ connectionId: string }> {
  const { id } = await createConnection(db, input.profileId, input.provider);
  try {
    await fillConnection(db, id, input);
  } catch (err) {
    // The connection's secret, calendars and blocks cascade with it.
    await db.from("calendar_connections").delete().eq("id", id);
    throw new StoreError(`Failed while saving; rolled back: ${String(err)}`);
  }
  return { connectionId: id };
}
