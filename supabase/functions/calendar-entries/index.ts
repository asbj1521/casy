/**
 * Tell Casy (#116): the entries a person kept in their own Casy calendar
 * (busy or away time that is in no calendar). The AI only proposes them
 * (entries-ai); nothing is saved until the page sends the ones the person
 * kept here.
 *
 * POST { action: "add", entries }  -> { entries }  (the ones saved, with ids)
 *      { action: "delete", id }    -> { deleted }
 *
 * Only ever the caller's own. They are read by the groups function (searches)
 * and calendar-busy (My calendar), which lists them.
 */
import { requireCaller } from "../_shared/auth.ts";
import {
  ENTRY_COLUMNS,
  type EntryRow,
  MAX_ENTRIES_IN_ALL,
  readEntries,
  storedFrom,
} from "../_shared/entries.ts";
import { HttpError, requireString, serve } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

serve("calendar-entries", async (req, body) => {
  const action = requireString(body, "action");
  const db = supabaseAdmin();
  const caller = await requireCaller(req, db);

  if (action === "add") {
    const entries = readEntries(body.entries, Date.now());
    if (!entries) throw new HttpError(400, "Those entries aren't valid.");

    const { count, error: countError } = await db
      .from("casy_entries")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", caller.id);
    if (countError) throw countError;
    if ((count ?? 0) + entries.length > MAX_ENTRIES_IN_ALL) {
      // Worded with the number itself so its Danish translation can be checked (i18n_test).
      throw new HttpError(400, "You can keep at most 100 entries. Delete some first.");
    }

    const { data, error } = await db
      .from("casy_entries")
      .insert(
        entries.map((e) => ({
          profile_id: caller.id,
          kind: e.kind,
          label: e.label,
          start_at: e.start,
          end_at: e.end,
          all_day: e.allDay,
        })),
      )
      .select(ENTRY_COLUMNS);
    if (error) throw error;
    return { entries: (data as EntryRow[]).map(storedFrom) };
  }

  if (action === "delete") {
    const id = requireString(body, "id");
    // A malformed id would reach Postgres as a type error and come back as a 500.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new HttpError(400, "That entry doesn't exist.");
    }
    const { data, error } = await db
      .from("casy_entries")
      .delete()
      .eq("id", id)
      .eq("profile_id", caller.id)
      .select("id");
    if (error) throw error;
    return { deleted: data.length > 0 };
  }

  throw new HttpError(400, "Unknown action.");
});
