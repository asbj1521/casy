/**
 * The signed-in caller's linked calendar accounts: each one's state, sync
 * health, calendars and how many busy blocks it holds.
 *
 * The profile page calls this on every load (not just right after an OAuth
 * redirect) so "connected" is a real, persistent fact backed by the
 * database, not something that only shows up once in a banner and vanishes
 * on refresh. Only ever non-secret fields: calendar_secrets is never touched.
 */
import { requireCaller } from "../_shared/auth.ts";
import { serve } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

interface SourceRow {
  id: string;
  display_name: string | null;
  custom_name: string | null;
  purpose: string | null;
  priority: string;
  writable: boolean;
  /** The blocks stored for it, counted by the database (an embedded count). */
  calendar_busy_cache: { count: number }[];
}

serve(
  "calendar-status",
  async (req) => {
    const db = supabaseAdmin();
    const { id: profileId } = await requireCaller(req, db);

    const { data, error } = await db
      .from("calendar_connections")
      .select(
        "id, provider, status, account_label, error_message, created_at, last_synced_at, last_sync_attempt_at, sync_error, needs_reconnect, " +
          "calendar_sources(id, display_name, custom_name, purpose, priority, writable, calendar_busy_cache(count))",
      )
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    // Each source's count is added up for its account and left off the source.
    const connections = (data as unknown as { calendar_sources: SourceRow[] }[]).map(
      ({ calendar_sources, ...connection }) => {
        let busyCount = 0;
        const sources = calendar_sources.map(({ calendar_busy_cache: [blocks], ...source }) => {
          busyCount += blocks?.count ?? 0;
          return source;
        });
        return { ...connection, calendar_sources: sources, busyCount };
      },
    );
    return { connections };
  },
  "GET",
);
