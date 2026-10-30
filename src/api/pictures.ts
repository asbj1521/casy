/**
 * Pictures (#187): your profile picture, kept by the pictures function in a
 * private bucket. What is sent is the JPEG the phone made (lib/pictureFile).
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
