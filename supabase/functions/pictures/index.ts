/**
 * Pictures (#186, #187, #188): your profile picture, for now.
 *
 * POST { action: "set-avatar", image }  -> { avatarUrl }
 *      { action: "remove-avatar" }      -> { avatarUrl: null }
 *
 * `image` is a JPEG the phone made (_shared/pictures.ts), base64. Only ever
 * your own; the old file is deleted once the new one is in place. Your groups
 * see it through the links the lists hand out.
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
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

serve("pictures", async (req, body) => {
  const action = requireString(body, "action");
  const db = supabaseAdmin();
  const caller = await requireCaller(req, db);

  const current = async () => {
    const { data, error } = await db
      .from("profiles")
      .select("avatar_path")
      .eq("id", caller.id)
      .maybeSingle();
    if (error) throw error;
    return (data?.avatar_path as string | null | undefined) ?? null;
  };

  if (action === "set-avatar") {
    const bytes = readPicture(body.image);
    if (!bytes) throw new HttpError(400, "That picture can't be used. Try another one.");
    const old = await current();
    const path = picturePath("avatar", caller.id);
    await storePicture(db, path, bytes);
    // The profile row exists once the person has used a group; made here otherwise.
    const { error } = await db
      .from("profiles")
      .upsert({ id: caller.id, avatar_path: path, updated_at: new Date().toISOString() });
    if (error) {
      await deletePictures(db, [path]);
      throw error;
    }
    await deletePictures(db, [old]);
    const links = await pictureLinks(db, [path]);
    return { avatarUrl: links.get(path) ?? null };
  }

  if (action === "remove-avatar") {
    const old = await current();
    if (old) {
      const { error } = await db
        .from("profiles")
        .update({ avatar_path: null, updated_at: new Date().toISOString() })
        .eq("id", caller.id);
      if (error) throw error;
      await deletePictures(db, [old]);
    }
    return { avatarUrl: null };
  }

  throw new HttpError(400, "Unknown action.");
});
