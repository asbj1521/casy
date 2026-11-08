/**
 * The scheduler's share of the calendar sync (#235): small runs every 15
 * minutes, each in a fresh worker, so no run comes near an Edge Function's
 * limits. Accounts are claimed as they are picked, so one that kills a run
 * can't stay first in line, and two runs never take the same one.
 */
import { runPooled } from "./groupRefresh.ts";
import type { Db } from "./supabaseAdmin.ts";
import type { SyncOutcome, SyncTarget } from "./sync.ts";

/** Stop starting new syncs after this long; the runtime's own limit is higher. */
export const SCHEDULED_BUDGET_MS = 100_000;
/** At most this many accounts per run: 300 an hour at four runs. */
export const SCHEDULED_BATCH = 75;
/** How many accounts sync at once. */
export const SCHEDULED_PARALLEL = 5;
/** An account is due this long after it was last tried: about hourly. */
export const STALE_AFTER_MS = 55 * 60_000;

/** The accounts this run will sync, already marked as tried. */
export async function claimDue(db: Pick<Db, "rpc">, now = new Date()): Promise<SyncTarget[]> {
  const { data, error } = await db.rpc("claim_sync_batch", {
    p_limit: SCHEDULED_BATCH,
    p_stale_before: new Date(now.getTime() - STALE_AFTER_MS).toISOString(),
  });
  if (error) throw error;
  return (data as { connection_id: string; connection_provider: SyncTarget["provider"] }[]).map(
    (row) => ({ id: row.connection_id, provider: row.connection_provider }),
  );
}

export interface RunResult {
  ok: number;
  failed: number;
  /** Claimed, but the budget ran out before their turn. */
  notStarted: SyncTarget[];
}

/** Sync `targets` a few at a time, starting none once `budgetMs` has passed. */
export async function syncWithin(
  targets: SyncTarget[],
  sync: (target: SyncTarget) => Promise<SyncOutcome>,
  budgetMs = SCHEDULED_BUDGET_MS,
): Promise<RunResult> {
  const started = Date.now();
  const result: RunResult = { ok: 0, failed: 0, notStarted: [] };
  await runPooled(targets, SCHEDULED_PARALLEL, async (target) => {
    if (Date.now() - started > budgetMs) {
      result.notStarted.push(target);
      return;
    }
    if ((await sync(target)).ok) result.ok++;
    else result.failed++;
  });
  return result;
}

/** Put accounts whose turn never came first in line for the next run. */
export async function releaseNotStarted(db: Db, targets: SyncTarget[]): Promise<void> {
  if (targets.length === 0) return;
  const { error } = await db
    .from("calendar_connections")
    .update({ last_sync_attempt_at: null })
    .in(
      "id",
      targets.map((t) => t.id),
    );
  if (error) throw error;
}

/** How many accounts are still due after this run took its share: the backlog. */
export async function countDue(db: Db, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_AFTER_MS).toISOString();
  const { count, error } = await db
    .from("calendar_connections")
    .select("id", { count: "exact", head: true })
    .eq("status", "connected")
    .neq("provider", "device")
    .or(`last_sync_attempt_at.is.null,last_sync_attempt_at.lt."${cutoff}"`);
  if (error) throw error;
  return count ?? 0;
}
