/**
 * "Your password is easier to guess than Casy now allows": set after someone
 * signs in with a password that fails today's rules or appears in a known
 * leak, and cleared once they save a new one or dismiss the note.
 *
 * Kept in sessionStorage (this tab, until it closes) under the user's id, so
 * another account signing in here never sees someone else's note. Components
 * subscribe to it (useSyncExternalStore), since it is set by the sign-in page
 * and read by a note shown above every page.
 */
import { readStored, writeStored } from "@/lib/storage";

const KEY = "casy-weak-password";
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** The id of the account whose password was found weak, if any. */
export function weakPasswordUserId(): string | null {
  return readStored(KEY, "session");
}

export function flagWeakPassword(userId: string) {
  writeStored(KEY, userId, "session");
  emit();
}

export function clearWeakPassword() {
  writeStored(KEY, null, "session");
  emit();
}

export function subscribeWeakPassword(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
