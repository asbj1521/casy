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
