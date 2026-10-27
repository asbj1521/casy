/**
 * 1 January, the day after New Year's Eve (#166). The New Year block
 * (holidayBlocks.ts) keeps everyone free of plans until 12:00, which already
 * keeps trips and holidays off the day (they are whole days); a meeting in
 * the afternoon or evening can still land on it. A big one doesn't by
 * default: it is never offered among a vote's dates, and the page's first
 * answer steps on past it. A small one is offered only after every other
 * good date. Picked by hand (a day tapped in the chart, or the date on
 * screen when sending), it stands, with a note (edgeWarnings).
 *
 * Big is what the event's AI profile says it does on that date (impactOn):
 * alcohol, a late night or heavy strain. Without a profile only the timing is
 * known, so only a meeting ending at LATE_FROM_HOUR or later is big.
 */
import type { EventImpact } from "@/api/eventProfile";
import { impactOn } from "@/lib/eventImpact";
import type { EventSettings } from "@/lib/eventSearch";
import { localDate } from "@/lib/zone";

/** Whether an instant (ISO) falls on 1 January in `timeZone`. */
export function onNewYearsDay(iso: string, timeZone: string): boolean {
  const { month, day } = localDate(Date.parse(iso), timeZone);
  return month === 0 && day === 1;
}

/** Whether `slot` is on 1 January and the event is a big one there. */
export function bigOnNewYearsDay(
  profile: EventImpact | null | undefined,
  slot: { start: string; end: string },
  settings: EventSettings,
  timeZone: string,
): boolean {
  if (settings.kind !== "single" || !onNewYearsDay(slot.start, timeZone)) return false;
  const { effects, strain } = impactOn(profile, slot, settings, timeZone);
  return effects.includes("alcohol") || effects.includes("lateNight") || strain === "heavy";
}
