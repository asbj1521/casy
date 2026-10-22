/**
 * What this phone shares for ranking a vote's dates (#119), backed by the
 * `day-facts` Edge Function: replaces the person's facts as a whole (an empty
 * list clears them). Only for those who said yes to the AI using their
 * calendar; the server refuses everyone else.
 */
import { currentMessages } from "@/i18n/current";
import type { DayFact } from "@/lib/dayFacts";
import { callFunction } from "@/lib/supabaseFunctions";

export async function pushDayFacts(facts: DayFact[]): Promise<void> {
  await callFunction("day-facts", {
    body: { facts },
    errorMessage: currentMessages().aiConsent.failed,
  });
}
