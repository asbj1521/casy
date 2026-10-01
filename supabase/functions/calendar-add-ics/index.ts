/**
 * Add a calendar by ICS link (a university timetable, Outlook's "publish
 * calendar" link, Google's secret iCal address, ...).
 *
 * Unlike the OAuth providers there is no browser redirect dance: the profile
 * page POSTs the link here, and errors go straight back to the form.
 *
 * Flow: validate + fetch the feed, strip it down to timing lines and expand
 * it into busy intervals (all in _shared/ics.ts), then store the connection,
 * its one calendar source, the link (encrypted, plus a lookup hash), and the
 * busy blocks (see _shared/storeCalendars.ts). The feed is fully processed
 * before anything is written, so a bad link leaves no rows. Adding the same
 * link again replaces the earlier connection; the hourly sync keeps it fresh
 * in between.
 *
 * The link is stored as the signed-in caller's.
 */
import { requireCaller } from "../_shared/auth.ts";
import { carryOverPurposes } from "../_shared/connections.ts";
import { HttpError, requireString, serve } from "../_shared/http.ts";
import { assertSafeFeedUrl, fetchFeedText, IcsError, parseBusyIntervals } from "../_shared/ics.ts";
import { encryptionKeyFromEnv, encryptSecret, lookupHash } from "../_shared/secretBox.ts";
import { storeCalendars } from "../_shared/storeCalendars.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { syncWindow } from "../_shared/syncWindow.ts";
import { cleanText } from "../_shared/text.ts";

const MAX_NAME_LENGTH = 80;

serve("calendar-add-ics", async (req, body) => {
  const db = supabaseAdmin();
  const { id: profileId } = await requireCaller(req, db);
  const rawUrl = requireString(body, "url");
  const name = cleanText(body.name, MAX_NAME_LENGTH);
  // Before fetching anything: with no key there is nowhere safe to keep the link.
  const key = encryptionKeyFromEnv();

  // Everything that can fail because of the link happens before any write.
  let feedUrl: URL;
  let parsed: ReturnType<typeof parseBusyIntervals>;
  try {
    feedUrl = assertSafeFeedUrl(rawUrl);
    const { start, end } = syncWindow();
    parsed = parseBusyIntervals(await fetchFeedText(feedUrl.toString()), start, end);
  } catch (err) {
    throw err instanceof IcsError ? new HttpError(400, err.message) : err;
  }

  const label = name || parsed.calendarName || feedUrl.hostname;
  // The link is a bearer secret, so only its encrypted form is stored. The
  // hash is what finds "this same link, added before" below.
  const normalizedUrl = feedUrl.toString();
  const urlHash = await lookupHash(normalizedUrl, key);

  // A feed is one calendar, so it gets a single source.
  const { connectionId } = await storeCalendars(db, {
    profileId,
    provider: "ics",
    accountLabel: label,
    secrets: {
      ics_url: await encryptSecret(normalizedUrl, key),
      ics_url_hash: urlHash,
    },
    calendars: [{ externalId: "ics", displayName: label, intervals: parsed.intervals }],
  });

  // Same link added before by this profile: the new connection supersedes it.
  try {
    const { data: older, error } = await db
      .from("calendar_secrets")
      .select("connection_id, calendar_connections!inner(profile_id, provider)")
      .eq("ics_url_hash", urlHash)
      .eq("calendar_connections.profile_id", profileId)
      .eq("calendar_connections.provider", "ics")
      .neq("connection_id", connectionId);
    if (error) throw error;
    const oldIds = older.map((r) => r.connection_id);
    if (oldIds.length > 0) {
      // Keep any category the user set on the link's calendar.
      await carryOverPurposes(db, oldIds, connectionId);
      await db.from("calendar_connections").delete().in("id", oldIds);
    }
  } catch (err) {
    console.error("Failed to remove superseded ICS connection (new one is fine)", err);
  }

  return { connectionId, label, busyBlocks: parsed.intervals.length };
});
