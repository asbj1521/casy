/**
 * Casy's AI using content from your calendar (#120): which wording of the
 * consent the app asks about, and whether the person already said "not now".
 */
import { readStored, writeStored } from "@/lib/storage";

/**
 * The wording of the consent the app shows. Kept equal to CONSENT_VERSION in
 * supabase/functions/_shared/aiAccess.ts, which raises it whenever the AI may
 * do more with calendar content; a "not now" is remembered per version, so a
 * wider ask is put to everyone again.
 */
export const AI_CONSENT_VERSION = 1;

const key = (userId: string) => `casy-ai-consent-asked:${userId}`;

/** Whether this person already answered "not now" to the current wording. */
export function wasAskedAboutAi(userId: string): boolean {
  return readStored(key(userId)) === String(AI_CONSENT_VERSION);
}

export function rememberAskedAboutAi(userId: string): void {
  writeStored(key(userId), String(AI_CONSENT_VERSION));
}
