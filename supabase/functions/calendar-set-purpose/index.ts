/**
 * Set (or clear) the category of one calendar: work, school, personal, other;
 * and/or its priority: skip, normal, never; and/or whether it counts at all
 * (the tick box on My calendar); and/or the name its owner gave it (null
 * goes back to the provider's own name).
 *
 * This is the "mark them after what they are" step from the privacy design:
 * categories and priorities live on the calendar (calendar_sources.purpose
 * and .priority), never on individual events, and every busy block inherits
 * its calendar's. The name is historical: it came before priorities.
 *
 * Called via fetch() from the SPA with the signed-in person's token; only a
 * calendar in one of their own connections can be changed.
 */
import { callerId } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { withLanguage } from "../_shared/i18n.ts";

const PURPOSES = new Set(["work", "school", "personal", "other"]);
const PRIORITIES = new Set(["skip", "normal", "never"]);
/** Matches the check on calendar_sources.custom_name. */
const MAX_NAME_LENGTH = 60;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(
  withLanguage(async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return json({ error: "Use POST" }, 405);
    }

    const db = supabaseAdmin();
    const profileId = await callerId(req, db);
    if (!profileId) return json({ error: "Please sign in again." }, 401);

    let payload: {
      calendarId?: unknown;
      purpose?: unknown;
      priority?: unknown;
      included?: unknown;
      name?: unknown;
    };
    try {
      payload = await req.json();
    } catch {
      return json({ error: "Body must be JSON" }, 400);
    }
    const { calendarId, purpose, priority, included, name } = payload;
    if (typeof calendarId !== "string") {
      return json({ error: "calendarId is required" }, 400);
    }
    // Any field may be left out to keep it as it is, but not all of them.
    if (
      purpose === undefined &&
      priority === undefined &&
      included === undefined &&
      name === undefined
    ) {
      return json({ error: "purpose, priority, included or name is required" }, 400);
    }
    // null clears the category; anything else must be one of the four.
    if (
      purpose !== undefined &&
      purpose !== null &&
      !(typeof purpose === "string" && PURPOSES.has(purpose))
    ) {
      return json({ error: "purpose must be work, school, personal, other or null" }, 400);
    }
    if (priority !== undefined && !(typeof priority === "string" && PRIORITIES.has(priority))) {
      return json({ error: "priority must be skip, normal or never" }, 400);
    }
    if (included !== undefined && typeof included !== "boolean") {
      return json({ error: "included must be true or false" }, 400);
    }
    // A name is trimmed; null or nothing left goes back to the provider's name.
    if (name !== undefined && name !== null && typeof name !== "string") {
      return json({ error: "name must be text or null" }, 400);
    }
    const customName = typeof name === "string" && name.trim() ? name.trim() : null;
    if (customName !== null && customName.length > MAX_NAME_LENGTH) {
      // Written out rather than built from the constant, so its translation
      // (_shared/i18n.ts) can find it word for word.
      return json({ error: "Keep the name to 60 characters." }, 400);
    }

    // Ownership check first: the calendar's connection must belong to the caller.
    const { data: owned, error: lookupErr } = await db
      .from("calendar_sources")
      .select("id, calendar_connections!inner(profile_id)")
      .eq("id", calendarId)
      .eq("calendar_connections.profile_id", profileId)
      .maybeSingle();
    if (lookupErr) {
      console.error("calendar-set-purpose lookup failed", lookupErr);
      return json({ error: "Lookup failed" }, 500);
    }
    if (!owned) return json({ error: "Calendar not found" }, 404);

    const changes = {
      ...(purpose !== undefined ? { purpose } : {}),
      ...(priority !== undefined ? { priority } : {}),
      ...(included !== undefined ? { included } : {}),
      ...(name !== undefined ? { custom_name: customName } : {}),
    };
    const { data: updated, error: updateErr } = await db
      .from("calendar_sources")
      .update(changes)
      .eq("id", calendarId)
      .select("purpose, priority, included, custom_name")
      .single();
    if (updateErr) {
      console.error("calendar-set-purpose update failed", updateErr);
      return json({ error: "Update failed" }, 500);
    }
    return json({
      calendarId,
      purpose: updated.purpose,
      priority: updated.priority,
      included: updated.included,
      customName: updated.custom_name,
    });
  }),
);
