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
 * Only a calendar in one of the signed-in caller's own connections can be
 * changed.
 */
import { requireCaller } from "../_shared/auth.ts";
import { HttpError, requireString, serve } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const PURPOSES: ReadonlySet<unknown> = new Set(["work", "school", "personal", "other"]);
const PRIORITIES: ReadonlySet<unknown> = new Set(["skip", "normal", "never"]);
/** Matches the check on calendar_sources.custom_name. */
const MAX_NAME_LENGTH = 60;

serve("calendar-set-purpose", async (req, body) => {
  const db = supabaseAdmin();
  const { id: profileId } = await requireCaller(req, db);

  const calendarId = requireString(body, "calendarId");
  const { purpose, priority, included, name } = body;
  // Any field may be left out to keep it as it is, but not all of them.
  if (
    purpose === undefined &&
    priority === undefined &&
    included === undefined &&
    name === undefined
  ) {
    throw new HttpError(400, "purpose, priority, included or name is required");
  }
  // null clears the category; anything else must be one of the four.
  if (purpose !== undefined && purpose !== null && !PURPOSES.has(purpose)) {
    throw new HttpError(400, "purpose must be work, school, personal, other or null");
  }
  if (priority !== undefined && !PRIORITIES.has(priority)) {
    throw new HttpError(400, "priority must be skip, normal or never");
  }
  if (included !== undefined && typeof included !== "boolean") {
    throw new HttpError(400, "included must be true or false");
  }
  // A name is trimmed; null or nothing left goes back to the provider's name.
  if (name !== undefined && name !== null && typeof name !== "string") {
    throw new HttpError(400, "name must be text or null");
  }
  const customName = typeof name === "string" && name.trim() ? name.trim() : null;
  if (customName !== null && customName.length > MAX_NAME_LENGTH) {
    // Written out rather than built from the constant, so its translation
    // (_shared/i18n.ts) can find it word for word.
    throw new HttpError(400, "Keep the name to 60 characters.");
  }

  // Ownership check first: the calendar's connection must belong to the caller.
  const { data: owned, error: lookupErr } = await db
    .from("calendar_sources")
    .select("id, calendar_connections!inner(profile_id)")
    .eq("id", calendarId)
    .eq("calendar_connections.profile_id", profileId)
    .maybeSingle();
  if (lookupErr) throw lookupErr;
  if (!owned) throw new HttpError(404, "Calendar not found");

  const { data: updated, error: updateErr } = await db
    .from("calendar_sources")
    .update({
      ...(purpose !== undefined ? { purpose } : {}),
      ...(priority !== undefined ? { priority } : {}),
      ...(included !== undefined ? { included } : {}),
      ...(name !== undefined ? { custom_name: customName } : {}),
    })
    .eq("id", calendarId)
    .select("purpose, priority, included, custom_name")
    .single();
  if (updateErr) throw updateErr;
  return {
    calendarId,
    purpose: updated.purpose,
    priority: updated.priority,
    included: updated.included,
    customName: updated.custom_name,
  };
});
