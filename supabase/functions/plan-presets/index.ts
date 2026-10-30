/**
 * Genveje (#175): a person's saved plans, run again with one tap from the
 * Planlæg sheet.
 *
 * POST { action: "list" }                   -> { presets }
 *      { action: "save", id?, name, plan }  -> { presets, savedId }
 *      { action: "delete", id }             -> { presets }
 *
 * Only ever the caller's own. A genvej has no group: it runs with whichever
 * group is chosen in the Planlæg sheet.
 */
import { requireCaller } from "../_shared/auth.ts";
import { HttpError, requireString, serve } from "../_shared/http.ts";
import {
  MAX_PRESETS,
  PRESET_COLUMNS,
  type PresetRow,
  presetFrom,
  readPreset,
  readUuid,
} from "../_shared/presets.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

serve("plan-presets", async (req, body) => {
  const action = requireString(body, "action");
  const db = supabaseAdmin();
  const caller = await requireCaller(req, db);

  const list = async () => {
    const { data, error } = await db
      .from("plan_presets")
      .select(PRESET_COLUMNS)
      .eq("profile_id", caller.id)
      .order("created_at");
    if (error) throw error;
    return (data as PresetRow[]).map(presetFrom);
  };

  if (action === "list") return { presets: await list() };

  if (action === "save") {
    const preset = readPreset(body);
    if (!preset) throw new HttpError(400, "That shortcut isn't valid.");
    const row = { name: preset.name, plan: preset.plan };

    let savedId: string;
    if (preset.id) {
      const { data, error } = await db
        .from("plan_presets")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", preset.id)
        .eq("profile_id", caller.id)
        .select("id");
      if (error) throw error;
      if (data.length === 0) throw new HttpError(404, "That shortcut no longer exists.");
      savedId = preset.id;
    } else {
      const { count, error: countError } = await db
        .from("plan_presets")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", caller.id);
      if (countError) throw countError;
      if ((count ?? 0) >= MAX_PRESETS) {
        // Worded with the number itself so its Danish translation can be checked (i18n_test).
        throw new HttpError(400, "You can keep at most 6 shortcuts. Delete one first.");
      }
      const { data, error } = await db
        .from("plan_presets")
        .insert({ ...row, profile_id: caller.id })
        .select("id")
        .single();
      if (error) throw error;
      savedId = (data as { id: string }).id;
    }
    return { presets: await list(), savedId };
  }

  if (action === "delete") {
    const id = readUuid(body.id);
    if (!id) throw new HttpError(400, "That shortcut no longer exists.");
    const { error } = await db
      .from("plan_presets")
      .delete()
      .eq("id", id)
      .eq("profile_id", caller.id);
    if (error) throw error;
    return { presets: await list() };
  }

  throw new HttpError(400, "Unknown action.");
});
