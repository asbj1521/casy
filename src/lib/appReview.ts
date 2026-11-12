/**
 * Asking for a rating on the App Store (#256), through the app's own Review
 * plugin (ReviewPlugin.swift): iOS's own small sheet with stars. A new app
 * with few ratings is shown last in App Store search, even for its own name,
 * so the people who use Casy are asked, at a moment that went well: a date
 * agreed, just flown into their calendar (PhoneCalendar). Casy asks at most
 * once every four months; iOS shows it at most three times a year, and never
 * again once rated. The app's only (isNativeApp); never a reason to fail.
 *
 * As in contactInvite.ts, @capacitor/core loads on first use and only the
 * module goes through promises, never the plugin itself.
 */
import { isNativeApp } from "@/lib/nativeApp";
import { readStored, writeStored } from "@/lib/storage";

/** When Casy last asked on this phone (an ISO time). */
const ASKED_KEY = "casy-review-asked";
/** The least time between two asks. */
const GAP_MS = 120 * 24 * 3_600_000;

interface ReviewPlugin {
  request(): Promise<void>;
}

let plugin: ReviewPlugin | null = null;

async function reviewPlugin(): Promise<{ plugin: ReviewPlugin }> {
  if (!plugin) {
    const { registerPlugin } = await import("@capacitor/core");
    plugin = registerPlugin<ReviewPlugin>("Review");
  }
  // Wrapped: resolving a promise with the plugin itself would never settle.
  return { plugin };
}

/** Whether it is time to ask again, by when it was last asked (`now` for tests). */
export function reviewDue(lastAsked: string | null, now: number): boolean {
  if (!lastAsked) return true;
  const at = Date.parse(lastAsked);
  return Number.isNaN(at) || now - at >= GAP_MS;
}

/** Ask, if it is time. Whatever happens, the page goes on as before. */
export async function askForReview(now = Date.now()): Promise<void> {
  if (!isNativeApp || !reviewDue(readStored(ASKED_KEY), now)) return;
  writeStored(ASKED_KEY, new Date(now).toISOString());
  try {
    const { plugin: review } = await reviewPlugin();
    await review.request();
  } catch {
    // An app build without the plugin, or no screen to ask on: nothing to do.
  }
}
