/**
 * The profile of an event being planned (#113), backed by the
 * `event-profile` Edge Function: the event's name, place, note and planned
 * timing in, what it is likely to cause for the people going out. The
 * scheduler asks while the event is set up (useEventProfile) and sends the
 * profile with the dates; nothing is stored by this call.
 *
 * The types mirror supabase/functions/_shared/profileAi.ts.
 */
import type { Confidence, Effect, Strain } from "@/lib/eventVocabulary";
import { callFunction } from "@/lib/supabaseFunctions";

/** The event as sent: only what the suggester typed, and its planned timing. */
export interface EventToProfile {
  /** The name typed, or the kind of event's stored name when none was. */
  title: string;
  place: string;
  note: string;
  kind: "meeting" | "trip" | "holiday";
  /** Meetings: the planned start, minutes after midnight; -1 for "any time". */
  startMinute: number;
  /** Meetings: the planned length in minutes. */
  minutes: number;
  /** Trips and holidays: how many days. */
  days: number;
}

/** What the event is likely to cause for the people going, whatever the date. */
export interface EventImpact {
  v: number;
  /** In the words labels use for what an event can't stand the day before (#112). */
  effects: Effect[];
  /** Likely to go on past its planned end (a party, not a meeting). */
  runsLate: boolean;
  strain: Strain;
  /** Days after it people may need to recover. */
  recoveryDays: number;
  outdoors: boolean;
  /** Needs daylight to happen as planned. */
  daylight: boolean;
  confidence: Confidence;
  /** One line, in the suggester's language. */
  reason: string;
}

export async function profileEvent(event: EventToProfile): Promise<EventImpact> {
  const { profile } = await callFunction<{ profile: EventImpact; left: number }>("event-profile", {
    body: { event },
  });
  return profile;
}
