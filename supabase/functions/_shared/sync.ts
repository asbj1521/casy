/**
 * Re-sync one connected account: fetch its busy times afresh and swap them in.
 *
 * Connecting an account copies its busy times once; this keeps them current.
 * It uses the credentials stored (encrypted) at connect time: a refresh token
 * for Google and Outlook, the app-specific password for iCloud, the link for
 * an ICS feed. Busy times are only ever replaced by a complete new set, in one
 * database transaction (replace_busy_blocks), so a sync that fails halfway
 * leaves the previous data exactly as it was.
 *
 * The outcome is recorded on the connection for the profile page: when it
 * last worked, and if not, why. A refused credential sets `needs_reconnect`,
 * because no amount of retrying fixes that; anything else is assumed to be
 * temporary and simply retried on the next run.
 */
import { fetchAppleBusy } from "./appleBusy.ts";
import { CalDavLoginError } from "./caldav.ts";
import { markGoneEntries } from "./calendarWrites.ts";
import * as google from "./google.ts";
import { assertSafeFeedUrl, fetchFeedText, parseBusyIntervals } from "./ics.ts";
import type { RawBusyInterval } from "./intervals.ts";
import * as outlook from "./outlook.ts";
import { ReauthRequired } from "./reauth.ts";
import { decryptSecret, encryptSecret } from "./secretBox.ts";
import { syncWindow } from "./syncWindow.ts";
import type { supabaseAdmin } from "./supabaseAdmin.ts";

type Db = ReturnType<typeof supabaseAdmin>;

/** An access token this close to expiry is refreshed rather than used. */
const TOKEN_MARGIN_MS = 2 * 60_000;

export type Provider = "google" | "outlook" | "apple" | "ics";

export interface SyncTarget {
  id: string;
  provider: Provider;
}

export type SyncOutcome =
  | { connectionId: string; ok: true; busyBlocks: number }
  | { connectionId: string; ok: false; needsReconnect: boolean; message: string };

interface SecretsRow {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  caldav_username: string | null;
  caldav_password: string | null;
  ics_url: string | null;
}

const PROVIDER_NAMES: Record<Provider, string> = {
  google: "Google",
  outlook: "Microsoft",
  apple: "iCloud",
  ics: "the calendar link",
};

/** Sync one connection and record the result on it. Never throws. */
export async function syncConnection(
  db: Db,
  target: SyncTarget,
  encryptionKey: string,
  now = new Date(),
): Promise<SyncOutcome> {
  const attemptedAt = now.toISOString();
  try {
    const busyBlocks = await refreshBusy(db, target, encryptionKey, now);
    const { error } = await db
      .from("calendar_connections")
      .update({
        last_synced_at: attemptedAt,
        last_sync_attempt_at: attemptedAt,
        sync_error: null,
        needs_reconnect: false,
      })
      .eq("id", target.id);
    if (error) throw error;
    return { connectionId: target.id, ok: true, busyBlocks };
  } catch (err) {
    const needsReconnect = err instanceof ReauthRequired || err instanceof CalDavLoginError;
    // The stored message is shown to the person, so it is written for them;
    // the provider's own reply (which can be long and technical) goes to the logs.
    const message = needsReconnect
      ? `${PROVIDER_NAMES[target.provider]} no longer accepts Casy's access. Reconnect this account.`
      : `Couldn't reach ${PROVIDER_NAMES[target.provider]}. Casy will try again within the hour.`;
    console.error(`sync of ${target.provider} connection ${target.id} failed`, err);
    await db
      .from("calendar_connections")
      .update({ last_sync_attempt_at: attemptedAt, sync_error: message, needs_reconnect: needsReconnect })
      .eq("id", target.id);
    return { connectionId: target.id, ok: false, needsReconnect, message };
  }
}

/** Fetch and store fresh busy times; returns how many blocks were stored. */
async function refreshBusy(
  db: Db,
  target: SyncTarget,
  key: string,
  now: Date,
): Promise<number> {
  const [{ data: secrets, error: secretsErr }, { data: sources, error: sourcesErr }] =
    await Promise.all([
      db.from("calendar_secrets").select("*").eq("connection_id", target.id).maybeSingle(),
      db.from("calendar_sources").select("id, external_calendar_id, writable").eq("connection_id", target.id),
    ]);
  if (secretsErr) throw secretsErr;
  if (sourcesErr) throw sourcesErr;
  // Credentials wiped when encryption arrived, or never stored: only a
  // reconnect can provide new ones.
  if (!secrets) throw new ReauthRequired("No stored credentials.");

  // From a week back (syncWindow.ts): events under way are fetched whole.
  const { start: windowStart, end: windowEnd } = syncWindow(now);
  const externalIds = (sources ?? []).map((s: { external_calendar_id: string }) => s.external_calendar_id);

  // Entries Casy adds from here on can't be in this read, so they aren't judged by it.
  const readStartedAt = new Date();
  const fresh = await fetchFresh(db, target, secrets as SecretsRow, key, externalIds, windowStart, windowEnd, now);

  const blocks = (sources ?? []).flatMap((s: { id: string; external_calendar_id: string }) =>
    (fresh.busy[s.external_calendar_id] ?? []).map((iv) => ({
      source_id: s.id,
      start_at: iv.start,
      end_at: iv.end,
    })),
  );
  const { data: stored, error: replaceErr } = await db.rpc("replace_busy_blocks", {
    p_connection_id: target.id,
    p_from: windowStart.toISOString(),
    p_blocks: blocks,
  });
  if (replaceErr) throw replaceErr;

  // Whether Casy may add events to each calendar can change (a share turned
  // view-only), and accounts connected before it was recorded start at false.
  // Only rows that changed are written, which is usually none.
  if (fresh.writable) {
    for (const s of (sources ?? []) as { id: string; external_calendar_id: string; writable: boolean }[]) {
      const writable = fresh.writable[s.external_calendar_id];
      if (writable === undefined || writable === s.writable) continue;
      const { error } = await db.from("calendar_sources").update({ writable }).eq("id", s.id);
      if (error) throw error;
    }
  }

  // Events Casy added to this account that are no longer anywhere in it were
  // deleted by hand: say so on My events. Only after a complete read (a
  // failed calendar throws above), and never at the cost of the sync itself.
  if (fresh.seenUids) {
    try {
      // Judged from now on: an event that is over matters no longer.
      await markGoneEntries(db, target.id, fresh.seenUids, readStartedAt, now, windowEnd);
    } catch (err) {
      console.error(`checking Casy's entries in connection ${target.id} failed`, err);
    }
  }
  return stored as number;
}

/** A fresh fetch: busy intervals, plus which calendars Casy may write to where known. */
interface Fresh {
  /** Busy intervals keyed by the provider's calendar id. */
  busy: Record<string, RawBusyInterval[]>;
  /** Per calendar id; only iCloud reports it so far. */
  writable?: Record<string, boolean>;
  /** Every event UID in the whole account (iCloud only), for markGoneEntries. */
  seenUids?: Set<string>;
}

async function fetchFresh(
  db: Db,
  target: SyncTarget,
  secrets: SecretsRow,
  key: string,
  externalIds: string[],
  windowStart: Date,
  windowEnd: Date,
  // The real time, for token expiry: the window starts a week back.
  now: Date,
): Promise<Fresh> {
  const from = windowStart.toISOString();
  const to = windowEnd.toISOString();

  switch (target.provider) {
    case "google": {
      const accessToken = await oauthAccess(db, target.id, secrets, key, now, (refreshToken) =>
        google.refreshAccessToken({ refreshToken, ...oauthClient("GOOGLE") }),
      );
      return { busy: await google.queryFreeBusy(accessToken, externalIds, from, to) };
    }
    case "outlook": {
      const accessToken = await oauthAccess(db, target.id, secrets, key, now, (refreshToken) =>
        outlook.refreshAccessToken({ refreshToken, ...oauthClient("MICROSOFT") }),
      );
      return { busy: await outlook.queryFreeBusy(accessToken, externalIds, from, to) };
    }
    case "apple": {
      if (!secrets.caldav_username || !secrets.caldav_password) {
        throw new ReauthRequired("No stored iCloud login.");
      }
      const password = await decryptSecret(secrets.caldav_password, key);
      const { calendars, uids } = await fetchAppleBusy(
        { username: secrets.caldav_username, password },
        windowStart,
        windowEnd,
      );
      return {
        busy: Object.fromEntries(calendars.map((c) => [c.id, c.intervals])),
        writable: Object.fromEntries(calendars.map((c) => [c.id, c.writable])),
        seenUids: uids,
      };
    }
    case "ics": {
      if (!secrets.ics_url) throw new ReauthRequired("No stored link.");
      // Re-checked on every fetch, not just when added: the rules for which
      // hosts are safe to fetch may have tightened since.
      const url = assertSafeFeedUrl(await decryptSecret(secrets.ics_url, key));
      const parsed = parseBusyIntervals(await fetchFeedText(url.toString()), windowStart, windowEnd);
      return { busy: { ics: parsed.intervals } }; // a feed is one calendar, stored as "ics"
    }
  }
}

/** The app's OAuth client credentials for a provider, from the function's secrets. */
function oauthClient(prefix: "GOOGLE" | "MICROSOFT"): { clientId: string; clientSecret: string } {
  const clientId = Deno.env.get(`${prefix}_OAUTH_CLIENT_ID`);
  const clientSecret = Deno.env.get(`${prefix}_OAUTH_CLIENT_SECRET`);
  if (!clientId || !clientSecret) throw new Error(`${prefix}_OAUTH_CLIENT_ID / _SECRET not set`);
  return { clientId, clientSecret };
}

/**
 * A usable access token: the stored one while it has a couple of minutes
 * left, otherwise a fresh one from the refresh token. Whatever the provider
 * hands back is stored encrypted, including a replacement refresh token
 * (Microsoft rotates them; Google usually keeps the old one).
 */
async function oauthAccess(
  db: Db,
  connectionId: string,
  secrets: SecretsRow,
  key: string,
  now: Date,
  refresh: (refreshToken: string) => Promise<{ access_token: string; refresh_token?: string; expires_in: number }>,
): Promise<string> {
  const expiresAt = secrets.expires_at ? Date.parse(secrets.expires_at) : 0;
  if (secrets.access_token && expiresAt - TOKEN_MARGIN_MS > now.getTime()) {
    return await decryptSecret(secrets.access_token, key);
  }
  if (!secrets.refresh_token) throw new ReauthRequired("No stored refresh token.");

  const tokens = await refresh(await decryptSecret(secrets.refresh_token, key));
  const update: Record<string, string> = {
    access_token: await encryptSecret(tokens.access_token, key),
    expires_at: new Date(now.getTime() + tokens.expires_in * 1000).toISOString(),
    updated_at: now.toISOString(),
  };
  if (tokens.refresh_token) update.refresh_token = await encryptSecret(tokens.refresh_token, key);
  const { error } = await db.from("calendar_secrets").update(update).eq("connection_id", connectionId);
  if (error) throw error;
  return tokens.access_token;
}
