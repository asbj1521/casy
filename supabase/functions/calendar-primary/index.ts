/**
 * The primary calendar: which one of your calendars Casy adds agreed events
 * to, and whether it does so automatically ("Add automatically").
 *
 * POST with an `action` in the body, like the groups and events functions:
 *
 * - get:      your current choice
 * - set:      { calendarId } makes that calendar primary; { calendarId: null }
 *             clears the choice (and with it "Add automatically")
 * - auto-add: { autoAdd } switches adding automatically on or off; needs a
 *             primary calendar first
 *
 * Every action answers with the resulting choice, so the page can show it
 * without asking again. The site's language is remembered each time, since
 * calendar entries are written in it (they may be written with no page open).
 * Switching "Add automatically" on also adds the events already scheduled,
 * after the answer has gone (see calendarWrites.ts). Only a calendar in one
 * of the caller's own connections, and one Casy may write to
 * (calendar_sources.writable), can be chosen; the primary_calendars trigger
 * checks ownership again.
 */
import { requireCaller } from "../_shared/auth.ts";
import { catchUpWrites } from "../_shared/calendarWrites.ts";
import { afterResponse, HttpError, serve } from "../_shared/http.ts";
import { langOf } from "../_shared/i18n.ts";
import { encryptionKeyFromEnv } from "../_shared/secretBox.ts";
import { type Db, supabaseAdmin } from "../_shared/supabaseAdmin.ts";

async function currentChoice(db: Db, profileId: string) {
  const { data, error } = await db
    .from("primary_calendars")
    .select("source_id, auto_add")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return { primary: data ? { calendarId: data.source_id, autoAdd: data.auto_add } : null };
}

serve("calendar-primary", async (req, body) => {
  const db = supabaseAdmin();
  const { id: profileId } = await requireCaller(req, db);
  const lang = langOf(req);

  switch (body.action) {
    case "get":
      break;

    case "set": {
      const { calendarId } = body;
      if (calendarId === null) {
        const { error } = await db.from("primary_calendars").delete().eq("profile_id", profileId);
        if (error) throw error;
        break;
      }
      if (typeof calendarId !== "string") throw new HttpError(400, "calendarId is required");
      const { data: source, error: lookupErr } = await db
        .from("calendar_sources")
        .select("id, writable, calendar_connections!inner(profile_id, status)")
        .eq("id", calendarId)
        .eq("calendar_connections.profile_id", profileId)
        .eq("calendar_connections.status", "connected")
        .maybeSingle();
      if (lookupErr) throw lookupErr;
      if (!source) throw new HttpError(404, "Calendar not found");
      if (!source.writable) throw new HttpError(400, "Casy can't add events to that calendar.");
      // Changing calendars keeps "Add automatically" as it was; a first
      // choice starts with it off.
      const { error } = await db.from("primary_calendars").upsert(
        {
          profile_id: profileId,
          source_id: calendarId,
          lang,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" },
      );
      if (error) throw error;
      // Anything still waiting to be added goes to the new calendar; what is
      // already added stays where it is.
      const { error: moveErr } = await db
        .from("calendar_event_writes")
        .update({ source_id: calendarId, attempts: 0, last_error: null })
        .eq("profile_id", profileId)
        .eq("wanted", true)
        .eq("added", false);
      if (moveErr) throw moveErr;
      break;
    }

    case "auto-add": {
      const { autoAdd } = body;
      if (typeof autoAdd !== "boolean") throw new HttpError(400, "autoAdd must be true or false");
      const { data, error } = await db
        .from("primary_calendars")
        .update({ auto_add: autoAdd, lang, updated_at: new Date().toISOString() })
        .eq("profile_id", profileId)
        .select("profile_id");
      if (error) throw error;
      if (data.length === 0) throw new HttpError(400, "Choose a primary calendar first.");
      // In go the events already scheduled, once the answer has gone.
      if (autoAdd) {
        afterResponse("adding scheduled events", () =>
          catchUpWrites(db, encryptionKeyFromEnv(), { profileId }),
        );
      }
      break;
    }

    default:
      throw new HttpError(400, "Unknown action");
  }
  return await currentChoice(db, profileId);
});
