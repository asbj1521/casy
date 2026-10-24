import { type Db } from "./supabaseAdmin.ts";

interface SourceRow {
  id: string;
  display_name: string | null;
  custom_name: string | null;
  purpose: string | null;
  /** Who set the category: its owner, Casy's AI (#118), or nobody yet. */
  purpose_source: "user" | "ai" | null;
  priority: string;
  writable: boolean;
  external_calendar_id: string;
  /** The blocks stored for it, counted by the database (an embedded count). */
  calendar_busy_cache: { count: number }[];
}

/**
 * A person's calendar accounts with their calendars and how many busy blocks
 * each holds: what the calendar-status function answers, and part of the
 * groups function's `start` (#158).
 */
export async function calendarStatus(db: Db, profileId: string) {
  const { data, error } = await db
    .from("calendar_connections")
    .select(
      "id, provider, status, account_label, error_message, created_at, last_synced_at, last_sync_attempt_at, sync_error, needs_reconnect, " +
        "calendar_sources(id, display_name, custom_name, purpose, purpose_source, priority, writable, external_calendar_id, calendar_busy_cache(count))",
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // Each source's count is added up for its account and left off the source.
  const connections = (
    data as unknown as { provider: string; calendar_sources: SourceRow[] }[]
  ).map(({ calendar_sources, ...connection }) => {
    let busyCount = 0;
    const sources = calendar_sources.map(
      ({ calendar_busy_cache: [blocks], external_calendar_id, ...source }) => {
        busyCount += blocks?.count ?? 0;
        // A phone calendar's EventKit id, so the app on that phone can
        // find its events (as calendar-busy's externalId); no other
        // provider's id is needed by the page.
        return {
          ...source,
          external_id: connection.provider === "device" ? external_calendar_id : null,
        };
      },
    );
    return { ...connection, calendar_sources: sources, busyCount };
  });
  return connections;
}
