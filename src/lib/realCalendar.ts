/**
 * The bridge between the signed-in person's real calendars and the
 * scheduling engine.
 *
 * What is stored per busy block is only its time range and which calendar it
 * came from; the calendar carries the category the person gave it. The
 * engine wants each block to say whether it is work/school (which you could
 * take time off from) or anything else (which rules the time out), so the
 * calendar's category is copied onto its blocks here.
 *
 * Used for the example groups only: there, the signed-in person's own real
 * calendar takes the "you" slot, and everyone else stays made up. Real groups
 * get every member's blocks, categories included, from the groups function.
 */
import type { OverviewData } from "@/lib/calendarOverview";
import type { BusyInterval, EventCategory, Participant } from "@/types";

/**
 * Which calendar categories carry over to the engine. Work and school are the
 * "soft" kinds the multi-day rules treat as time you could take off; personal,
 * other and uncategorised calendars carry no category, so their blocks simply
 * count as busy.
 */
const CATEGORY_FOR_PURPOSE: Partial<Record<string, EventCategory>> = {
  work: "work",
  school: "school",
};

/**
 * The person's blocks in the engine's shape. The calendar's own name goes in
 * `title`, which is what the approval banner shows ("you have Work in your
 * calendar"): the person's own label for their own calendar, never an event
 * title, since none are stored. Its priority comes along too, left out when
 * normal, the same as the groups function sends it. A calendar its owner
 * unticked on My calendar is left out entirely, as the groups function does.
 */
export function busyFromCalendars(data: OverviewData): BusyInterval[] {
  const byId = new Map(data.calendars.map((c) => [c.id, c]));
  const busy: BusyInterval[] = [];
  for (const b of data.blocks) {
    const cal = byId.get(b.calendarId);
    // From a calendar no longer listed, or one its owner unticked.
    if (!cal?.included) continue;
    busy.push({
      start: b.start,
      end: b.end,
      title: cal.name,
      category: cal.purpose ? CATEGORY_FOR_PURPOSE[cal.purpose] : undefined,
      ...(cal.priority === "skip" || cal.priority === "never" ? { priority: cal.priority } : {}),
    });
  }
  return busy;
}

/**
 * The participants with one person's generated calendar replaced by their
 * real busy time (and real name). Nothing is modified in place: the example
 * groups are shared and cached.
 */
export function withRealCalendar(
  participants: Participant[],
  profileId: string,
  name: string,
  busy: BusyInterval[],
): Participant[] {
  return participants.map((p) =>
    p.profileId === profileId ? { ...p, name: name || p.name, busy } : p,
  );
}
