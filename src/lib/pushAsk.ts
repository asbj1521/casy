/**
 * When Casy asks to send notifications (#139). iOS shows its own prompt only
 * once, ever: a no there can only be undone in iPhone's Settings. So Casy
 * asks first, in its own sheet, where people are waiting on others and the
 * value of a notification is plain (right after sending dates, after
 * answering a vote, after joining a group or inviting someone), and iOS's
 * prompt follows only a yes. "Ikke nu" is asked again at the next such moment
 * a week later at the earliest, three times at most.
 *
 * This file knows nothing of Capacitor, so the places that ask (a page, a
 * hook) can import it without pulling the plugin in.
 */
import { readStored, writeStored } from "@/lib/storage";
import { isNativeApp } from "@/lib/nativeApp";

/** Why the sheet is shown: what the person has just done. */
export type AskReason = "sent" | "answered" | "joined";

/** What iOS says about notifications for Casy. */
export type PushPermission = "prompt" | "granted" | "denied";

/** How often Casy has asked, and when last. */
export interface AskState {
  asked: number;
  last: number | null;
}

const WEEK_MS = 7 * 86_400_000;
export const MAX_ASKS = 3;
const KEY = "casy-push-ask";
const EVENT = "casy:push-ask";

/** Whether to show the sheet now. */
export function mayAsk(state: AskState, permission: PushPermission, now: number): boolean {
  if (permission !== "prompt") return false;
  if (state.asked >= MAX_ASKS) return false;
  return state.last === null || now - state.last >= WEEK_MS;
}

export function readAskState(): AskState {
  try {
    const parsed = JSON.parse(readStored(KEY) ?? "") as Partial<AskState>;
    return {
      asked: typeof parsed.asked === "number" ? parsed.asked : 0,
      last: typeof parsed.last === "number" ? parsed.last : null,
    };
  } catch {
    return { asked: 0, last: null };
  }
}

/** The sheet was shown now. */
export function recordAsk(now: number): void {
  const state = readAskState();
  writeStored(KEY, JSON.stringify({ asked: state.asked + 1, last: now }));
}

/** Say that a moment worth asking at has come; the sheet decides whether to show. App only. */
export function askForPush(reason: AskReason): void {
  if (!isNativeApp) return;
  window.dispatchEvent(new CustomEvent<AskReason>(EVENT, { detail: reason }));
}

/** Listen for those moments (the sheet, once); answers how to stop. */
export function onAskForPush(listener: (reason: AskReason) => void): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<AskReason>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
