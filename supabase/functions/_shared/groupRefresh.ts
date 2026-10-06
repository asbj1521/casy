/**
 * Freshening a group's busy times while someone plans for it (the groups
 * function's `refresh` action, #85): every member's calendar account that
 * hasn't been synced for a while is synced now, so the scheduler doesn't
 * offer a time someone filled since the hourly sync.
 *
 * Bounded three ways, since any member can ask:
 *   - only accounts not tried in the last FRESH_FOR_MS are synced, so asking
 *     again soon syncs nothing and nobody can hammer the providers through it;
 *   - those accounts are claimed in one update first, so two members asking at
 *     once never sync the same account twice;
 *   - the caller waits at most REFRESH_DEADLINE_MS. Slower syncs (iCloud, as a
 *     rule) carry on after the answer and are saved all the same.
 *
 * The caller learns only whether everything finished and whether anything was
 * synced: never whose account, which provider, or whether one failed.
 */
import type { Db } from "./supabaseAdmin.ts";
import type { SyncOutcome, SyncTarget } from "./sync.ts";

/** An account tried this recently counts as fresh and is left alone. */
export const FRESH_FOR_MS = 10 * 60_000;
/** How long the caller waits for the syncs. */
export const REFRESH_DEADLINE_MS = 10_000;
/** At most this many accounts sync at once. */
export const REFRESH_PARALLEL = 8;

/**
 * The members' connected accounts due a sync, claimed: their last attempt is
 * set to now in the same update that picks them, so a second caller a moment
 * later finds them fresh.
 */
export async function claimStaleConnections(
  db: Db,
  memberIds: string[],
  now = new Date(),
): Promise<SyncTarget[]> {
  const cutoff = new Date(now.getTime() - FRESH_FOR_MS).toISOString();
  const { data, error } = await db
    .from("calendar_connections")
    .update({ last_sync_attempt_at: now.toISOString() })
    .in("profile_id", memberIds)
    .eq("status", "connected")
    // Quoted: a timestamp's ":" and "." are reserved inside PostgREST's or().
    .or(`last_sync_attempt_at.is.null,last_sync_attempt_at.lt."${cutoff}"`)
    .select("id, provider");
  if (error) throw error;
  return data as SyncTarget[];
}

/** Run `work` over `items`, at most `limit` at a time; done when all are. */
export async function runPooled<T>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<unknown>,
): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) await work(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}

/** Wait for `work`, but no longer than `ms`: true if it finished in time. */
export async function within(work: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  try {
    return await Promise.race([work.then(() => true), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export interface RefreshResult {
  /** Every claimed account finished syncing (well or not) within the deadline. */
  complete: boolean;
  /** At least one account was due, so the group's busy times may have changed. */
  synced: boolean;
  /** The syncs still running, for the caller to keep alive after answering. */
  rest: Promise<void>;
}

/** Sync `targets` in parallel, answering by the deadline whether or not they are done. */
export async function refreshTargets(
  targets: SyncTarget[],
  sync: (target: SyncTarget) => Promise<SyncOutcome>,
  deadlineMs = REFRESH_DEADLINE_MS,
): Promise<RefreshResult> {
  if (targets.length === 0) return { complete: true, synced: false, rest: Promise.resolve() };
  // syncConnection never throws, but a stand-in might: one failure must not
  // stop the others or the answer.
  const rest = runPooled(targets, REFRESH_PARALLEL, (t) => sync(t).catch(() => null));
  const complete = await within(rest, deadlineMs);
  return { complete, synced: true, rest };
}
