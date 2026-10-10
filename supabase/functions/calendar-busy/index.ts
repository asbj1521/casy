/**
 * The signed-in person's own connected calendars plus their busy blocks
 * inside a date range: My calendar reads a month at a time, and the
 * scheduling page its whole search window (for the example groups, where
 * your own calendar takes the "you" slot).
 *
 * Only what the app actually stores comes back: block timestamps, the
 * calendar's own name, its account, provider and category, and for a phone
 * calendar its EventKit id. There are no event
 * titles anywhere in this data by design (see the calendar_integrations
 * migration and each adapter), so none can leak from here. Never touches
 * calendar_secrets.
 */
import { requireCaller } from "../_shared/auth.ts";
import { readRange, serve } from "../_shared/http.ts";
import { supabaseAdmin, type Db } from "../_shared/supabaseAdmin.ts";

/** A calendar_sources row joined to its connection, as selected below. */
interface SourceRow {
  id: string;
  external_calendar_id: string;
  display_name: string | null;
  custom_name: string | null;
  writable: boolean;
  purpose: string | null;
  purpose_source: "user" | "ai" | null;
  priority: string;
  included: boolean;
  /** Every block stored for it (the embedded count below). */
  calendar_busy_cache: { count: number }[];
  calendar_connections: {
    id: string;
    provider: string;
    account_label: string | null;
  };
}

const PAGE_SIZE = 1000; // PostgREST's default row cap per request
const MAX_PAGES = 10; // stop at 10k blocks rather than build an unbounded response

serve(
  "calendar-busy",
  async (req) => {
    const params = new URL(req.url).searchParams;
    const { from, to } = readRange(params.get("from"), params.get("to"));
    const db = supabaseAdmin();
    const { id: profileId } = await requireCaller(req, db);

    const [sources, blocks] = await Promise.all([
      db
        .from("calendar_sources")
        .select(
          "id, external_calendar_id, display_name, custom_name, writable, purpose, purpose_source, priority, included, calendar_busy_cache(count), calendar_connections!inner(id, provider, account_label)",
        )
        .eq("calendar_connections.profile_id", profileId)
        .eq("calendar_connections.status", "connected"),
      fetchBlocks(db, profileId, from, to),
    ]);
    if (sources.error) throw sources.error;

    // `!inner` on a to-one join returns one connection, not the array the
    // untyped client assumes; hence the cast, as in the groups function.
    const calendars = ((sources.data ?? []) as unknown as SourceRow[])
      .map((s) => ({
        id: s.id,
        // The name its owner gave it wins; the provider's own name comes
        // along so the page can say which calendar it really is.
        name: s.custom_name ?? s.display_name ?? "Calendar",
        originalName: s.display_name,
        renamed: s.custom_name !== null,
        // Whether it can be made the primary calendar (Casy may add events to it).
        writable: s.writable,
        purpose: s.purpose,
        // A category Casy's AI guessed (#118), marked as such until its owner picks one.
        purposeGuessed: s.purpose_source === "ai" && s.purpose !== null,
        priority: s.priority,
        // Unticked calendars still come back, blocks and all: the page lists
        // them unticked, and the scheduling page leaves them out itself.
        included: s.included,
        // Busy blocks stored for it over the whole synced range (a week back
        // to a year ahead), whatever range was asked for.
        total: s.calendar_busy_cache[0]?.count ?? 0,
        provider: s.calendar_connections.provider,
        account: s.calendar_connections.account_label,
        connectionId: s.calendar_connections.id,
        // A phone calendar's EventKit id, so the app on that phone can show
        // its own events' titles in place of these blocks without sending
        // them anywhere. Other providers' ids aren't needed by the page.
        externalId: s.calendar_connections.provider === "device" ? s.external_calendar_id : null,
      }))
      // By the provider's name, not the owner's: calendars without a category
      // are coloured in this order, so renaming one must not recolour the rest.
      .sort(
        (a, b) =>
          (a.account ?? "").localeCompare(b.account ?? "") ||
          (a.originalName ?? a.name).localeCompare(b.originalName ?? b.name),
      );

    return { calendars, ...blocks };
  },
  "GET",
);

/**
 * Every block of the caller's connected calendars that overlaps the range,
 * a page at a time. Reached through a join on the owner rather than by source
 * id, so it can run alongside the sources query.
 */
async function fetchBlocks(db: Db, profileId: string, from: Date, to: Date) {
  const blocks: { calendarId: string; start: string; end: string }[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    // Overlap test: a block belongs to the range if it starts before the
    // range ends and ends after the range starts.
    const { data, error } = await db
      .from("calendar_busy_cache")
      .select(
        "source_id, start_at, end_at, calendar_sources!inner(calendar_connections!inner(profile_id, status))",
      )
      .eq("calendar_sources.calendar_connections.profile_id", profileId)
      .eq("calendar_sources.calendar_connections.status", "connected")
      .lt("start_at", to.toISOString())
      .gt("end_at", from.toISOString())
      .order("start_at", { ascending: true })
      .order("id", { ascending: true }) // stable paging when start times tie
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    for (const r of data)
      blocks.push({ calendarId: r.source_id, start: r.start_at, end: r.end_at });
    if (data.length < PAGE_SIZE) return { blocks, truncated: false };
  }
  return { blocks, truncated: true };
}
