/**
 * Sending what the push queue holds (#139), called by the push function when
 * the database says something was queued (see the push_notifications
 * migration for what queues what). Each claimed row is written in the
 * language of each phone it goes to and sent; a row Apple could not be
 * reached for is put back, twice at most.
 */
import { type ApnsKey, deliver } from "./apns.ts";
import { type PushFacts, composePush, type PushTopic } from "./pushText.ts";
import type { Db } from "./supabaseAdmin.ts";

/** Tries a notification gets in all: the first, and two more if Apple can't be reached. */
const MAX_ATTEMPTS = 3;
/** Rows taken at a time. */
const BATCH = 50;

/** A claimed row of push_queue. */
interface QueueRow {
  id: number;
  profile_id: string;
  kind: string;
  topic: PushTopic;
  proposal_id: string | null;
  group_id: string | null;
  actor_name: string | null;
  attempts: number;
}

interface Device {
  token: string;
  environment: "production" | "sandbox" | null;
  lang: "da" | "en";
}

/** The event's name and chosen date, read once for a row. */
async function eventFacts(db: Db, proposalId: string) {
  const { data, error } = await db
    .from("event_proposals")
    .select("title, event_proposal_dates(starts_at, chosen_at)")
    .eq("id", proposalId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const dates = (data.event_proposal_dates ?? []) as {
    starts_at: string;
    chosen_at: string | null;
  }[];
  const chosen = dates.find((d) => d.chosen_at !== null);
  return { title: data.title as string, chosenAt: chosen ? Date.parse(chosen.starts_at) : null };
}

async function groupName(db: Db, groupId: string): Promise<string | null> {
  const { data, error } = await db
    .from("friend_groups")
    .select("name")
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw error;
  return (data?.name as string | undefined) ?? null;
}

/** Whether the thing a notification is about still exists and still says it. */
function stillTrue(row: QueueRow, event: { chosenAt: number | null } | null): boolean {
  if (row.proposal_id && !event) return false;
  // "The date is set" with no date chosen any more (it was reopened since).
  if ((row.topic === "decided" || row.topic === "moved") && event?.chosenAt == null) return false;
  return true;
}

/**
 * Send what is waiting. Answers how many notifications went to how many
 * phones, and how many were dropped (nothing to say any more, or no phone).
 */
export async function drainQueue(
  db: Db,
  key: ApnsKey,
): Promise<{ claimed: number; sent: number; dropped: number }> {
  let claimed = 0;
  let sent = 0;
  let dropped = 0;

  for (;;) {
    const { data, error } = await db.rpc("push_claim", { p_limit: BATCH });
    if (error) throw error;
    const rows = (data ?? []) as QueueRow[];
    if (rows.length === 0) break;
    claimed += rows.length;

    for (const row of rows) {
      try {
        const [event, group, devices] = await Promise.all([
          row.proposal_id ? eventFacts(db, row.proposal_id) : null,
          row.group_id ? groupName(db, row.group_id) : null,
          db
            .from("push_devices")
            .select("token, environment, lang")
            .eq("profile_id", row.profile_id),
        ]);
        if (devices.error) throw devices.error;
        const phones = (devices.data ?? []) as Device[];
        if (phones.length === 0 || !stillTrue(row, event)) {
          dropped++;
          continue;
        }
        const facts: PushFacts = {
          topic: row.topic,
          proposalId: row.proposal_id,
          actorName: row.actor_name,
          eventTitle: event?.title ?? null,
          groupName: group,
          chosenAt: event?.chosenAt ?? null,
        };
        let reached = false;
        let unreachable = false;
        for (const phone of phones) {
          const outcome = await deliver(
            phone.token,
            phone.environment,
            composePush(facts, phone.lang),
            key,
          );
          if (outcome.result === "sent") {
            reached = true;
            if (outcome.environment !== phone.environment) {
              await db
                .from("push_devices")
                .update({ environment: outcome.environment })
                .eq("token", phone.token);
            }
          } else if (outcome.result === "gone") {
            await db.from("push_devices").delete().eq("token", phone.token);
          } else {
            unreachable = true;
            console.warn(`push ${row.topic} to ${row.profile_id} failed: ${outcome.reason}`);
          }
        }
        if (reached) sent++;
        else if (unreachable && row.attempts + 1 < MAX_ATTEMPTS) {
          await db.from("push_queue").insert({
            profile_id: row.profile_id,
            kind: row.kind,
            topic: row.topic,
            proposal_id: row.proposal_id,
            group_id: row.group_id,
            actor_name: row.actor_name,
            attempts: row.attempts + 1,
          });
        } else dropped++;
      } catch (err) {
        // One row's trouble never stops the rest; it is not sent again.
        dropped++;
        console.error(`push row ${row.id} (${row.topic}) failed`, err);
      }
    }
    if (rows.length < BATCH) break;
  }
  return { claimed, sent, dropped };
}

/** Whether two secrets are equal, in time that doesn't depend on where they differ. */
export function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
