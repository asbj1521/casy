/**
 * Trip detection (#115), backed by the `trip-legs` Edge Function: this
 * phone's travel events (title, place, calendar name, all day or not) in,
 * one leg per event out: flight, train, bus or none, and between which
 * cities. Only from the iPhone app, in the background; the function keeps
 * nothing. See supabase/functions/_shared/tripLegs.ts.
 */
import type { Confidence } from "@/lib/eventVocabulary";
import { callFunction } from "@/lib/supabaseFunctions";

/** The title says the way leads home ("Fly hjem"); the phone knows which city. */
export const HOME = "HOME";

export interface TripLeg {
  /** "none": not a journey by plane, train or bus. */
  mode: "flight" | "train" | "bus" | "none";
  /** City names in English (Copenhagen), HOME, or "" when nothing says. */
  from: string;
  to: string;
  confidence: Confidence;
}

/** One distinct travel event, as sent. */
export interface EventToRead {
  title: string;
  location: string;
  calendar: string;
  allDay: boolean;
}

export async function readTripLegs(
  events: EventToRead[],
): Promise<{ legs: (TripLeg | null)[]; left: number }> {
  return await callFunction("trip-legs", { body: { events } });
}
