/**
 * The calendar entry Casy writes for an accepted trip ("Læg i min kalender",
 * #115) is in the phone's calendar like any other event, and its title
 * ("Rejse til Oslo") reads as a journey. Read back as one, it asked about the
 * trip all over again (#154). Every such entry carries Casy's note, in the
 * language the app had when it was written, so both are recognised.
 */
import type { PhoneEventWithDetails } from "@/lib/phoneEvents";

/**
 * `trips.calendarNote` in Danish and English, copied so this file doesn't pull
 * both languages in; casyTripEntry.test.ts keeps the copy equal.
 */
export const TRIP_NOTES = ["Lagt ind af Casy.", "Added by Casy."];

const NOTES = new Set(TRIP_NOTES);

/** Whether this phone event is a trip Casy wrote into the calendar itself. */
export function isCasyTripEntry(e: PhoneEventWithDetails): boolean {
  return NOTES.has(e.notes?.trim() ?? "");
}
