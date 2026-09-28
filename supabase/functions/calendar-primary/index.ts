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
 * after the answer has gone (see calendarWrites.ts). Only a calendar in one of the caller's own
 * connections, and one Casy may write to (calendar_sources.writable), can be
 * chosen; the primary_calendars trigger checks ownership again.
 */
import { callerId } from "../_shared/auth.ts";
import { processWrites, queueAutoAdds } from "../_shared/calendarWrites.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { encryptionKeyFromEnv } from "../_shared/secretBox.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { langOf, withLanguage } from "../_shared/i18n.ts";

type Db = ReturnType<typeof supabaseAdmin>;

/** Supabase's edge runtime: keeps the function alive for work after the response. */
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

/** Add the caller's already scheduled events, once the answer has gone. */
function addScheduledLater(db: Db, profileId: string) {
  let key: string;
  try {
    key = encryptionKeyFromEnv();
  } catch (err) {
    console.error("calendar writes are not configured", err);
    return;
  }
  EdgeRuntime.waitUntil(
    (async () => {
      try {
        await queueAutoAdds(db, { profileId });
        await processWrites(db, key, { profileId });
      } catch (err) {
        console.error("adding scheduled events after Add automatically failed", err);
      }
    })(),
  );
}

/** What every action answers with. */
interface PrimaryChoice {
  primary: { calendarId: string; autoAdd: boolean } | null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function currentChoice(db: Db, profileId: string): Promise<PrimaryChoice> {
  const { data, error } = await db
    .from("primary_calendars")
    .select("source_id, auto_add")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return { primary: data ? { calendarId: data.source_id, autoAdd: data.auto_add } : null };
}

Deno.serve(withLanguage(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Use POST" }, 405);
  }

  const db = supabaseAdmin();
  const profileId = await callerId(req, db);
  if (!profileId) return json({ error: "Please sign in again." }, 401);
  const lang = langOf(req);

  let payload: { action?: unknown; calendarId?: unknown; autoAdd?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }

  try {
    switch (payload.action) {
      case "get":
        return json(await currentChoice(db, profileId));

      case "set": {
        const { calendarId } = payload;
        if (calendarId === null) {
          const { error } = await db.from("primary_calendars").delete().eq("profile_id", profileId);
          if (error) throw error;
          return json(await currentChoice(db, profileId));
        }
        if (typeof calendarId !== "string") {
          return json({ error: "calendarId is required" }, 400);
        }
        const { data: source, error: lookupErr } = await db
          .from("calendar_sources")
          .select("id, writable, calendar_connections!inner(profile_id, status)")
          .eq("id", calendarId)
          .eq("calendar_connections.profile_id", profileId)
          .eq("calendar_connections.status", "connected")
          .maybeSingle();
        if (lookupErr) throw lookupErr;
        if (!source) return json({ error: "Calendar not found" }, 404);
        if (!source.writable) {
          return json({ error: "Casy can't add events to that calendar." }, 400);
        }
        // Changing calendars keeps "Add automatically" as it was; a first
        // choice starts with it off.
        const { error } = await db.from("primary_calendars").upsert(
          { profile_id: profileId, source_id: calendarId, lang, updated_at: new Date().toISOString() },
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
        return json(await currentChoice(db, profileId));
      }

      case "auto-add": {
        const { autoAdd } = payload;
        if (typeof autoAdd !== "boolean") {
          return json({ error: "autoAdd must be true or false" }, 400);
        }
        const { data, error } = await db
          .from("primary_calendars")
          .update({ auto_add: autoAdd, lang, updated_at: new Date().toISOString() })
          .eq("profile_id", profileId)
          .select("profile_id");
        if (error) throw error;
        if (!data || data.length === 0) {
          return json({ error: "Choose a primary calendar first." }, 400);
        }
        if (autoAdd) addScheduledLater(db, profileId);
        return json(await currentChoice(db, profileId));
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    console.error("calendar-primary failed", payload.action, err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}));
