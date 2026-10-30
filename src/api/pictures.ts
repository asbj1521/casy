/**
 * Pictures (#187, #188): your profile picture and your groups', kept by the
 * pictures function in a private bucket. What is sent is the JPEG the phone made (lib/pictureFile).
 */
import { currentMessages } from "@/i18n/current";
import { callFunction } from "@/lib/supabaseFunctions";

/** Your new profile picture; answers with a link to it. */
export async function setAvatar(image: string): Promise<string | null> {
  const answer = await callFunction<{ avatarUrl: string | null }>("pictures", {
    body: { action: "set-avatar", image },
    errorMessage: currentMessages().pictures.saveFailed,
  });
  return answer.avatarUrl;
}

export async function removeAvatar(): Promise<void> {
  await callFunction("pictures", {
    body: { action: "remove-avatar" },
    errorMessage: currentMessages().pictures.removeFailed,
  });
}

/** A group's new picture (any member may); answers with a link to it. */
export async function setGroupPicture(groupId: string, image: string): Promise<string | null> {
  const answer = await callFunction<{ pictureUrl: string | null }>("pictures", {
    body: { action: "set-group-picture", groupId, image },
    errorMessage: currentMessages().pictures.saveFailed,
  });
  return answer.pictureUrl;
}

export async function removeGroupPicture(groupId: string): Promise<void> {
  await callFunction("pictures", {
    body: { action: "remove-group-picture", groupId },
    errorMessage: currentMessages().pictures.removeFailed,
  });
}
