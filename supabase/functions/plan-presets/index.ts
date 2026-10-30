/**
 * Genveje (#175): a person's saved plans, run again with one tap from the
 * Planlæg sheet.
 *
 * POST { action: "list" }                             -> { presets }
 *      { action: "save", id?, name, plan, picture? }  -> { presets, savedId }
 *      { action: "delete", id }                       -> { presets }
 *
 * Only ever the caller's own. A genvej has no group: it runs with whichever
 * group is chosen in the Planlæg sheet.
 *
 * Its picture (#186) is saved with it, so a new genvej can have one too:
 * `picture` is a JPEG the phone made (base64), null to take it off, left out
 * to keep it. Seen only by its owner, through the link the list hands out;
 * the old file goes once the new one is in place, and with the genvej.
 */
import { requireCaller } from "../_shared/auth.ts";
import { HttpError, requireString, serve } from "../_shared/http.ts";
import {
  deletePictures,
  pictureLinks,
  picturePath,
  readPicture,
  storePicture,
} from "../_shared/pictures.ts";
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
    const rows = data as PresetRow[];
    const links = await pictureLinks(
      db,
      rows.map((r) => r.picture_path),
    );
    return rows.map((r) => ({
      ...presetFrom(r),
      pictureUrl: (r.picture_path && links.get(r.picture_path)) ?? null,
    }));
  };
  const pictureOf = async (id: string) => {
    const { data, error } = await db
      .from("plan_presets")
      .select("picture_path")
      .eq("id", id)
      .eq("profile_id", caller.id)
      .maybeSingle();
    if (error) throw error;
    return (data?.picture_path as string | null | undefined) ?? null;
  };

  if (action === "list") return { presets: await list() };

  if (action === "save") {
    const preset = readPreset(body);
    if (!preset) throw new HttpError(400, "That shortcut isn't valid.");
    let bytes: Uint8Array | null = null;
    if (typeof preset.picture === "string") {
      bytes = readPicture(preset.picture);
      if (!bytes) throw new HttpError(400, "That picture can't be used. Try another one.");
    }
    // A new genvej's id is made here, so its picture can be stored under it first.
    const savedId = preset.id ?? crypto.randomUUID();
    const path = bytes ? picturePath("shortcut", savedId) : null;
    const row: Record<string, unknown> = { name: preset.name, plan: preset.plan };
    if (preset.picture !== undefined) row.picture_path = path;
    // The file the row pointed at before, gone once the row no longer does.
    let old: string | null = null;
    const fail = async (error: unknown): Promise<never> => {
      await deletePictures(db, [path]);
      throw error;
    };

    if (preset.id) {
      if (preset.picture !== undefined) old = await pictureOf(preset.id);
      if (path && bytes) await storePicture(db, path, bytes);
      const { data, error } = await db
        .from("plan_presets")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", preset.id)
        .eq("profile_id", caller.id)
        .select("id");
      if (error) await fail(error);
      if (!data || data.length === 0) {
        await fail(new HttpError(404, "That shortcut no longer exists."));
      }
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
      if (path && bytes) await storePicture(db, path, bytes);
      const { error } = await db
        .from("plan_presets")
        .insert({ ...row, id: savedId, profile_id: caller.id });
      if (error) await fail(error);
    }
    await deletePictures(db, [old]);
    return { presets: await list(), savedId };
  }

  if (action === "delete") {
    const id = readUuid(body.id);
    if (!id) throw new HttpError(400, "That shortcut no longer exists.");
    // Read first: the file outlives the row otherwise.
    const old = await pictureOf(id);
    const { error } = await db
      .from("plan_presets")
      .delete()
      .eq("id", id)
      .eq("profile_id", caller.id);
    if (error) throw error;
    await deletePictures(db, [old]);
    return { presets: await list() };
  }

  throw new HttpError(400, "Unknown action.");
});
