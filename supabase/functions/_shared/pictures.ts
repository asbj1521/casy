/**
 * Pictures (#186, #187, #188): what the pictures function stores and the
 * lists link to. The files are JPEGs the phone made (a 512 px square, saved
 * again, so nothing a camera wrote into the photo is left), kept in the
 * private `pictures` bucket and shown through signed links that work for a
 * week. A new upload is a new path, so a changed picture is a new link.
 */
import type { Db } from "./supabaseAdmin.ts";

export const PICTURE_BUCKET = "pictures";
/** The largest picture taken, the bucket's own limit too. */
export const MAX_PICTURE_BYTES = 300 * 1024;
/** How long a link to a picture works: the lists hand out fresh ones each time. */
export const PICTURE_LINK_SECONDS = 7 * 24 * 60 * 60;

/** What a picture is of: a person, a group, a genvej. */
export type PictureKind = "avatar" | "group" | "shortcut";

/**
 * An upload as bytes: a JPEG (its first bytes say so), base64 in the body,
 * no larger than MAX_PICTURE_BYTES. Null for anything else.
 */
export function readPicture(raw: unknown): Uint8Array | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  // Base64 is 4 characters for 3 bytes: anything longer can't fit.
  if (raw.length > Math.ceil(MAX_PICTURE_BYTES / 3) * 4 + 4) return null;
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  const jpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return jpeg && bytes.length <= MAX_PICTURE_BYTES ? bytes : null;
}

/** A new path for one picture of `owner` (a person, group or genvej id). */
export function picturePath(kind: PictureKind, owner: string): string {
  return `${kind}/${owner}/${crypto.randomUUID()}.jpg`;
}

/** Stores the picture at `path`. */
export async function storePicture(db: Db, path: string, bytes: Uint8Array): Promise<void> {
  const { error } = await db.storage
    .from(PICTURE_BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
}

/** Deletes pictures no longer used; a failure is only logged, never worth failing a change for. */
export async function deletePictures(db: Db, paths: (string | null | undefined)[]): Promise<void> {
  const gone = paths.filter((p): p is string => !!p);
  if (gone.length === 0) return;
  const { error } = await db.storage.from(PICTURE_BUCKET).remove(gone);
  if (error) console.error("pictures: couldn't delete", gone.length, error);
}

/**
 * A group's picture path, read before something that may delete the group
 * (deleting it, its last member leaving): `deletePictures` takes it away
 * after, since the cascades can't reach a file.
 */
export async function groupPicturePath(db: Db, groupId: string): Promise<string | null> {
  const { data, error } = await db
    .from("friend_groups")
    .select("picture_path")
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw error;
  return (data?.picture_path as string | null | undefined) ?? null;
}

/**
 * A link for each picture path given (null paths left out), made in one
 * call. A link that can't be made leaves its picture out: the letter shows.
 */
export async function pictureLinks(
  db: Db,
  paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => !!p))];
  const links = new Map<string, string>();
  if (wanted.length === 0) return links;
  const { data, error } = await db.storage
    .from(PICTURE_BUCKET)
    .createSignedUrls(wanted, PICTURE_LINK_SECONDS);
  if (error) {
    console.error("pictures: couldn't make links", error);
    return links;
  }
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) links.set(item.path, item.signedUrl);
  }
  return links;
}
