/**
 * Refresh connected calendars' busy times (see _shared/sync.ts).
 *
 * Two callers, told apart by how they prove who they are:
 *
 *  - The hourly scheduler (pg_cron, see the calendar_sync migration) sends the
 *    shared secret in `x-sync-secret`. It gets every connected account,
 *    least recently tried first. The work continues in the background after
 *    a quick 202, because the scheduler doesn't wait for, or need, the result;
 *    whatever doesn't fit in the time budget is first in line next hour.
 *
 *  - The profile page's "Sync now" button sends the signed-in person's login
 *    and gets their own accounts synced, waiting for the result. An account
 *    tried in the last minute is skipped, so the button can't be used to
 *    hammer the providers.
 *
 * Both also catch up on calendar writes (_shared/calendarWrites.ts): agreed
 * events that should be in someone's primary calendar but aren't yet (a
 * failed try, or an event completed by someone leaving its group), and
 * cancelled ones still to be taken out.
 */
import { requireCaller } from "../_shared/auth.ts";
import { catchUpWrites } from "../_shared/calendarWrites.ts";
import { afterResponse, HttpError, json, serve } from "../_shared/http.ts";
import { encryptionKeyFromEnv } from "../_shared/secretBox.ts";
import { type Db, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { syncConnection, type SyncOutcome, type SyncTarget } from "../_shared/sync.ts";

/** Stop starting new syncs after this long; the runtime's own limit is higher. */
const SCHEDULED_BUDGET_MS = 100_000;
/** At most this many accounts per scheduled run. */
const SCHEDULED_BATCH = 200;
/** "Sync now" leaves an account alone if it was tried this recently. */
const MANUAL_COOLDOWN_MS = 60_000;
/** How long "Sync now" gives the calendar writes, after its answer has gone. */
const MANUAL_WRITES_BUDGET_MS = 30_000;

/** Compare secrets without leaking, through timing, how much of a guess was right. */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

serve("calendar-sync", async (req) => {
  const key = encryptionKeyFromEnv();
  const db = supabaseAdmin();

  // --- The scheduler ---------------------------------------------------------
  const presented = req.headers.get("x-sync-secret");
  if (presented !== null) {
    const expected = Deno.env.get("CALENDAR_SYNC_SECRET");
    if (!expected || !sameSecret(presented, expected)) throw new HttpError(401, "Not allowed");
    const { data, error } = await db
      .from("calendar_connections")
      .select("id, provider")
      .eq("status", "connected")
      // A phone sends its own calendars (calendar-phone); there is nothing to fetch.
      .neq("provider", "device")
      .order("last_sync_attempt_at", { ascending: true, nullsFirst: true })
      .limit(SCHEDULED_BATCH);
    if (error) throw error;
    const targets = data as SyncTarget[];
    afterResponse("scheduled sync", () => runScheduled(db, targets, key));
    return json({ queued: targets.length }, 202);
  }

  // --- A signed-in person's "Sync now" ---------------------------------------
  const { id: profileId } = await requireCaller(req, db);
  const { data, error } = await db
    .from("calendar_connections")
    .select("id, provider, last_sync_attempt_at")
    .eq("profile_id", profileId)
    .eq("status", "connected")
    // The app syncs the phone's calendars itself, before calling this.
    .neq("provider", "device");
  if (error) throw error;
  const cutoff = Date.now() - MANUAL_COOLDOWN_MS;
  const due = data.filter(
    (c) => !c.last_sync_attempt_at || Date.parse(c.last_sync_attempt_at) < cutoff,
  ) as SyncTarget[];

  // One at a time: a person has a handful of accounts, and running them in
  // parallel would only risk tripping a provider's rate limit.
  const results: SyncOutcome[] = [];
  for (const target of due) results.push(await syncConnection(db, target, key));
  afterResponse("calendar writes after Sync now", () =>
    catchUpWrites(db, key, { profileId }, MANUAL_WRITES_BUDGET_MS),
  );
  return { results, skipped: data.length - due.length };
});

async function runScheduled(db: Db, targets: SyncTarget[], key: string): Promise<void> {
  const started = Date.now();
  let ok = 0;
  let failed = 0;
  for (const target of targets) {
    if (Date.now() - started > SCHEDULED_BUDGET_MS) break;
    const outcome = await syncConnection(db, target, key);
    if (outcome.ok) ok++;
    else failed++;
  }
  console.log(
    `scheduled sync: ${ok} ok, ${failed} failed, ${targets.length - ok - failed} left for next run`,
  );
  // Votes past their deadline nobody has looked at since (#74): decided here,
  // so their calendar entries go in below. A failure only waits an hour.
  const { error } = await db.rpc("decide_due_votes", { p_profile_id: null });
  if (error) console.error("deciding due votes failed", error);
  // Busy times first; calendar writes get what is left of the budget.
  await catchUpWrites(db, key, {}, Math.max(10_000, SCHEDULED_BUDGET_MS - (Date.now() - started)));
}
