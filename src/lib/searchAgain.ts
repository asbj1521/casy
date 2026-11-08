/**
 * Searching an open vote again (#240): new dates for everyone it is for now,
 * the members added among them, found by the same search a vote's dates came
 * from (findEventSlot, then pickCandidates), from today.
 *
 * What people answered counts: a "can't" is that person busy then, so the
 * date isn't offered again, and a "rather not" is time they could skip, so a
 * date costing nobody anything goes first. A date everyone is still fine with
 * can come back as it was, and the server keeps its answers.
 */
import { pickCandidates } from "@/lib/candidates";
import { findEventSlot, type EventSettings } from "@/lib/eventSearch";
import type { GridItem } from "@/lib/monthGrid";
import { candidateMonth, PILE_TIMING, pileTimeline } from "@/lib/paperPile";
import { addDays, startOfMonth, wallTime } from "@/lib/zone";
import type { BusyInterval, Participant } from "@/types";

/** A vote's date with the answers on it, as the events list hands it out. */
interface AnsweredDate {
  start: string;
  end: string;
  answers: Record<string, string>;
}

/** The fewest and most dates a vote searched again offers. */
const MIN_DATES = 2;
const MAX_DATES = 5;

/** Everyone's busy time, with their answers to the vote's dates added to it. */
export function withAnswers(participants: Participant[], dates: AnsweredDate[]): Participant[] {
  return participants.map((p) => {
    const answered = dates.flatMap((d): BusyInterval[] => {
      const answer = d.answers[p.profileId];
      if (answer === "declined") return [{ start: d.start, end: d.end, priority: "never" }];
      if (answer === "maybe") return [{ start: d.start, end: d.end, priority: "skip" }];
      return [];
    });
    return answered.length > 0 ? { ...p, busy: [...p.busy, ...answered] } : p;
  });
}

/**
 * Who the search is for: the vote's own settings, with everyone invited now.
 * The whole group is said by naming nobody, as when suggesting; anyone still
 * left out is named, and those optional before stay optional. The server keeps
 * the same (settingsFor in _shared/events.ts).
 */
export function searchSettings(
  settings: EventSettings,
  invited: string[],
  group: string[],
): EventSettings {
  const people = settings.people;
  const all = group.every((id) => invited.includes(id));
  if (all && !people?.optional.length && people?.atLeast === undefined) {
    const rest = { ...settings };
    delete rest.people;
    return rest;
  }
  return {
    ...settings,
    people: {
      ...people,
      members: invited,
      optional: (people?.optional ?? []).filter((id) => invited.includes(id)),
    },
  };
}

/**
 * New dates for the vote, as many as it had (2 to 5), from `from` to `end`;
 * null when no date suits everyone it is for.
 */
export function searchAgainDates(
  participants: Participant[],
  settings: EventSettings,
  options: { from: string; end: string; count: number; now?: number },
  timeZone: string,
): { start: string; end: string }[] | null {
  const first = findEventSlot(participants, settings, options.from, options.end, timeZone);
  if (!first.slot) return null;
  const count = Math.min(MAX_DATES, Math.max(MIN_DATES, options.count));
  return pickCandidates(
    participants,
    settings,
    {
      first: { slot: first.slot, conflicts: first.conflicts },
      end: options.end,
      count,
      now: options.now,
    },
    timeZone,
  ).map((d) => ({ start: d.slot.start, end: d.slot.end }));
}

/** One calendar on the pile (#240): its busy time over the month shown, as bars. */
interface PileLayer {
  profileId: string;
  name: string;
  /** Searched just now for the first time: thrown on, not lying there already. */
  isNew: boolean;
  items: GridItem[];
  color: string;
  colorOf: (calendarId: string) => string;
}

/** What the search's pile shows (SearchAgainPile): a month, yours first, then everyone else's. */
export interface SearchAgainPile {
  /** The month's first local midnight. */
  month: number;
  you: { items: GridItem[]; colorOf: (calendarId: string) => string };
  layers: PileLayer[];
}

/** Your own calendar's colour on the pile: Casy's orange. */
const YOUR_COLOR = "234, 88, 12";

/**
 * The pile for a search (#240): the month holding most of the new dates, your
 * calendar under it, the calendars already searched on it, and those of the
 * people added (`added`) to be thrown on top. Only people with a calendar.
 */
export function searchAgainPile(
  participants: Participant[],
  youId: string,
  added: string[],
  dates: { start: string }[],
  colors: readonly string[],
  timeZone: string,
): SearchAgainPile {
  const { year, month } = candidateMonth(
    dates.map((d) => d.start),
    dates[0]?.start ?? new Date().toISOString(),
    timeZone,
  );
  const first = wallTime(year, month, 1, 0, timeZone);
  const from = addDays(first, -7, timeZone);
  const to = addDays(startOfMonth(first, timeZone, 1), 7, timeZone);
  const itemsOf = (p: Participant): GridItem[] =>
    p.busy
      .filter((b) => !b.holiday)
      .map((b) => ({
        calendarId: p.profileId,
        start: Date.parse(b.start),
        end: Date.parse(b.end),
        label: "",
      }))
      .filter((b) => b.end > from && b.start < to);
  const you = participants.find((p) => p.profileId === youId);
  const others = participants.filter((p) => p.profileId !== youId);
  // Those searched before first, so the new ones land on top of them.
  const ordered = [
    ...others.filter((p) => !added.includes(p.profileId)),
    ...others.filter((p) => added.includes(p.profileId)),
  ];
  return {
    month: first,
    you: { items: you ? itemsOf(you) : [], colorOf: () => YOUR_COLOR },
    layers: ordered.map((p, k) => {
      const color = colors[k % colors.length];
      return {
        profileId: p.profileId,
        name: p.name,
        isNew: added.includes(p.profileId),
        items: itemsOf(p),
        color,
        colorOf: () => color,
      };
    }),
  };
}

/** How long the pile is shown at least (#240): every new calendar landed, and a beat to see them. */
export function pileSeconds(newCalendars: number): number {
  const lands = pileTimeline(newCalendars, 0, 0.5).lands;
  const last = lands.at(-1);
  return Math.max(1.6, last ? last.at + last.duration + PILE_TIMING.impact + 0.9 : 0);
}
