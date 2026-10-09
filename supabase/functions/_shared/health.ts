/**
 * Whether calendar syncing is healthy (#88), for the public `health` function
 * an uptime monitor watches, and for admin mode. It looks at the result, not
 * at the job: if the hourly scheduler stopped altogether, nothing would run to
 * report it, but busy times going stale shows up here all the same.
 *
 * Says only "ok", or which of two things is wrong: never a count, an account
 * or a person.
 */
import type { Db } from "./supabaseAdmin.ts";

/** No account synced for this long: the hourly sync has stopped working. */
export const STALE_AFTER_MS = 3 * 60 * 60_000;
/** More than this share of accounts failing: something is wrong for everyone. */
export const FAILING_SHARE = 0.3;
/** Fewer connected accounts than this, and one bad account can't raise the alarm. */
export const MIN_ACCOUNTS_FOR_SHARE = 4;

export interface SyncFacts {
  /** Connected calendar accounts. */
  connected: number;
  /** Connected accounts whose last sync failed (not those needing a reconnect, which is the owner's to fix). */
  failing: number;
  /** The newest successful sync of any account, if there ever was one. */
  newestSync: string | null;
}

export type Health = { ok: true } | { ok: false; reason: "stale" | "failing" };

export function healthOf(facts: SyncFacts, now = Date.now()): Health {
  if (facts.connected === 0) return { ok: true };
  const newest = facts.newestSync ? Date.parse(facts.newestSync) : NaN;
  if (!(now - newest <= STALE_AFTER_MS)) return { ok: false, reason: "stale" };
  if (
    facts.connected >= MIN_ACCOUNTS_FOR_SHARE &&
    facts.failing / facts.connected > FAILING_SHARE
  ) {
    return { ok: false, reason: "failing" };
  }
  return { ok: true };
}

/**
 * The facts, read from calendar_connections in three small queries. Phone
 * calendars are left out: the phone sends them when its app opens, so one
 * unopened for hours is normal, not the sync failing.
 */
export async function readSyncFacts(db: Db): Promise<SyncFacts> {
  const [connected, failing, newest] = await Promise.all([
    db
      .from("calendar_connections")
      .select("id", { count: "exact", head: true })
      .eq("status", "connected")
      .neq("provider", "device"),
    db
      .from("calendar_connections")
      .select("id", { count: "exact", head: true })
      .eq("status", "connected")
      .neq("provider", "device")
      .eq("needs_reconnect", false)
      .not("sync_error", "is", null),
    db
      .from("calendar_connections")
      .select("last_synced_at")
      .eq("status", "connected")
      .neq("provider", "device")
      .not("last_synced_at", "is", null)
      .order("last_synced_at", { ascending: false })
      .limit(1),
  ]);
  if (connected.error) throw connected.error;
  if (failing.error) throw failing.error;
  if (newest.error) throw newest.error;
  return {
    connected: connected.count ?? 0,
    failing: failing.count ?? 0,
    newestSync:
      (newest.data?.[0] as { last_synced_at: string } | undefined)?.last_synced_at ?? null,
  };
}
