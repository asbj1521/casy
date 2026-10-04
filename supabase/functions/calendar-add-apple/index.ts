/**
 * Connect an iCloud account over CalDAV with an app-specific password.
 *
 * Like calendar-add-ics, the profile page POSTs here (no browser redirect
 * dance), and errors go straight back to the form. Apple has no OAuth for
 * calendars, hence the password.
 *
 * Flow: log in and discover every event calendar in the account, pull each
 * one's events as timing-only ICS, and reduce them to busy intervals with the
 * same parser the ICS-link feature uses. Only then is anything written: a
 * wrong password or an unreachable iCloud leaves no rows behind. The password
 * is encrypted (see _shared/secretBox.ts) before it is stored. Re-adding the
 * same account replaces the old connection and keeps its calendar categories.
 *
 * The account is stored as the signed-in caller's.
 */
import { fetchAppleBusy } from "../_shared/appleBusy.ts";
import { requireCaller } from "../_shared/auth.ts";
import { CalDavError } from "../_shared/caldav.ts";
import { pruneSupersededConnections } from "../_shared/connections.ts";
import { HttpError, serve } from "../_shared/http.ts";
import { encryptionKeyFromEnv, encryptSecret } from "../_shared/secretBox.ts";
import { storeCalendars } from "../_shared/storeCalendars.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { syncWindow } from "../_shared/syncWindow.ts";
import { stripControlChars } from "../_shared/text.ts";

const MAX_FIELD_LENGTH = 254;

/** Trimmed text with nothing odd in it, or null. */
function field(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  return text && text.length <= MAX_FIELD_LENGTH && stripControlChars(text) === text ? text : null;
}

serve("calendar-add-apple", async (req, body) => {
  // Checked before anything else, so no one can make us log in to iCloud
  // with a password without being signed in themselves.
  const db = supabaseAdmin();
  const { id: profileId } = await requireCaller(req, db);

  const username = field(body.username);
  // Apple shows app-specific passwords with dashes, and people paste stray spaces.
  const password = field(body.password);
  if (!username || !password) {
    throw new HttpError(400, "Enter your Apple account email and your app-specific password.");
  }
  // Before contacting Apple: better an error than an unencrypted credential.
  const key = encryptionKeyFromEnv();

  // Everything that can fail because of the account happens before any write.
  const { start, end } = syncWindow();
  const fetched = await fetchAppleBusy({ username, password }, start, end).catch((err) => {
    throw err instanceof CalDavError ? new HttpError(400, err.message) : err;
  });
  if (fetched.calendars.length === 0) {
    throw new HttpError(400, "That Apple account has no calendars we can read.");
  }

  const { connectionId } = await storeCalendars(db, {
    profileId,
    provider: "apple",
    accountLabel: username,
    secrets: {
      caldav_username: username,
      caldav_password: await encryptSecret(password, key),
    },
    calendars: fetched.calendars.map((c) => ({
      externalId: c.id,
      displayName: c.name,
      writable: c.writable,
      intervals: c.intervals,
    })),
  });

  // Same account added before: the new connection supersedes it (and failed
  // attempts), carrying over any work/school labels. Never throws.
  await pruneSupersededConnections(db, {
    profileId,
    provider: "apple",
    keepId: connectionId,
    accountLabel: username,
  });

  return {
    connectionId,
    label: username,
    calendars: fetched.calendars.length,
    busyBlocks: fetched.calendars.reduce((sum, c) => sum + c.intervals.length, 0),
    // A subscription whose feed failed has nothing stored yet; it is reported
    // with the unreadable events and filled in by a later sync.
    skippedEvents: fetched.skippedEvents + fetched.failedFeeds.length,
  };
});
