/** A group's busy time, as the groups function's `busy` action sends it (#160, split out of index.ts). */
import { type Db } from "../_shared/supabaseAdmin.ts";

export const PAGE_SIZE = 1000; // PostgREST's default row cap per request

export const MAX_PAGES = 20; // a whole group's year, bounded

/**
 * A member's calendar is called outdated once it hasn't been updated for this
 * long: a phone whose app hasn't been opened (the only way its calendars
 * reach Casy), or an account whose sync keeps failing. Their busy times still
 * count; the page only says so.
 */
export const OUTDATED_AFTER_MS = 2 * 24 * 60 * 60_000;

export async function groupBusy(db: Db, memberIds: string[], from: Date, to: Date) {
  const { data: sources, error: sourcesErr } = await db
    .from("calendar_sources")
    .select("id, purpose, priority, calendar_connections!inner(profile_id, status, last_synced_at)")
    .in("calendar_connections.profile_id", memberIds)
    .eq("calendar_connections.status", "connected")
    // A calendar its owner unticked on My calendar doesn't count at all.
    .eq("included", true);
  if (sourcesErr) throw sourcesErr;

  type SourceRow = {
    id: string;
    purpose: string | null;
    priority: string;
    calendar_connections: { profile_id: string; last_synced_at: string | null };
  };
  // What each block carries besides its times, from its calendar. Work and
  // school are the "soft" kinds the multi-day rules treat as time you could
  // take off, and a priority says whether its owner would skip it ("skip")
  // or never would ("never"); both are left out when they don't apply. Like
  // this, a block says how much it matters, never what it is.
  const sourceById = new Map(
    // `!inner` on a to-one join makes the connection a single row, which
    // only a cast can say.
    (sources as unknown as SourceRow[]).map((s) => [
      s.id,
      {
        owner: s.calendar_connections.profile_id,
        tags: {
          ...(s.purpose === "work" || s.purpose === "school" ? { category: s.purpose } : {}),
          ...(s.priority === "skip" || s.priority === "never" ? { priority: s.priority } : {}),
        },
      },
    ]),
  );

  const busyByMember = new Map<string, { start: string; end: string }[]>(
    memberIds.map((id) => [id, []]),
  );
  const sourceIds = [...sourceById.keys()];
  let truncated = false;
  if (sourceIds.length > 0) {
    // Overlap test: a block is in range if it starts before the range ends
    // and ends after the range starts.
    const fetchPage = (page: number, withCount = false) =>
      db
        .from("calendar_busy_cache")
        .select("source_id, start_at, end_at", withCount ? { count: "exact" } : undefined)
        .in("source_id", sourceIds)
        .lt("start_at", to.toISOString())
        .gt("end_at", from.toISOString())
        .order("start_at", { ascending: true })
        .order("id", { ascending: true }) // stable paging when start times tie
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    // The first page also says how many blocks there are in total, so every
    // other page can be asked for at once instead of one after another.
    const first = await fetchPage(0, true);
    if (first.error) throw first.error;
    const pagesNeeded = Math.ceil((first.count ?? first.data.length) / PAGE_SIZE);
    truncated = pagesNeeded > MAX_PAGES;
    const extraPages = Math.max(0, Math.min(pagesNeeded, MAX_PAGES) - 1);
    const rest = await Promise.all(Array.from({ length: extraPages }, (_, i) => fetchPage(i + 1)));
    for (const page of [first, ...rest]) {
      if (page.error) throw page.error;
      for (const r of page.data) {
        const source = sourceById.get(r.source_id);
        if (!source) continue;
        busyByMember.get(source.owner)?.push({ start: r.start_at, end: r.end_at, ...source.tags });
      }
    }
  }

  // What members told Casy that is in no calendar (#116): their own busy
  // time. A stretch away is never skipped, trips included, like a calendar
  // set to "never"; busy time at set hours is an ordinary block. Like a
  // calendar's blocks, only the times cross over, never the label.
  const entryOwners = new Set<string>();
  const { data: entries, error: entriesErr } = await db
    .from("casy_entries")
    .select("profile_id, kind, start_at, end_at")
    .in("profile_id", memberIds)
    .lt("start_at", to.toISOString())
    .gt("end_at", from.toISOString())
    .limit(PAGE_SIZE);
  if (entriesErr) throw entriesErr;
  for (const e of entries) {
    entryOwners.add(e.profile_id);
    busyByMember.get(e.profile_id)?.push({
      start: e.start_at,
      end: e.end_at,
      ...(e.kind === "away" ? { priority: "never" } : {}),
    });
  }

  // Who has actually linked something: a member with no calendar reads as
  // free all year, which the page must be able to say out loud rather than
  // quietly counting them as available. Someone who has told Casy their own
  // time has told it what it knows, so they are searched too.
  const hasCalendar = new Set(
    [...sourceById.values()].map((s) => s.owner).concat([...entryOwners]),
  );

  // Whose calendars are outdated, and since when: each member's least
  // recently updated account among the calendars that count. Only for those
  // past OUTDATED_AFTER_MS, so how often others open their app isn't shown.
  const oldest = new Map<string, number>();
  for (const s of sources as unknown as SourceRow[]) {
    const at = Date.parse(s.calendar_connections.last_synced_at ?? "") || 0;
    const owner = s.calendar_connections.profile_id;
    oldest.set(owner, Math.min(oldest.get(owner) ?? Infinity, at));
  }
  const outdatedBefore = Date.now() - OUTDATED_AFTER_MS;
  const outdated = Object.fromEntries(
    [...oldest]
      .filter(([, at]) => at > 0 && at < outdatedBefore)
      .map(([id, at]) => [id, new Date(at).toISOString()]),
  );
  return {
    busy: Object.fromEntries(busyByMember),
    connected: Object.fromEntries(memberIds.map((id) => [id, hasCalendar.has(id)])),
    outdated,
    truncated,
  };
}
