/**
 * Searching an open vote again (#240): new dates for everyone it is for now,
 * the members added among them, found by the same search a vote's dates came
 * from, from today. On the phone it is Planlæg itself, opened with the vote's
 * plan (planFromVote) and its answers counted (withAnswers).
 *
 * What people answered counts: a "can't" is that person busy then, so the
 * date isn't offered again, and a "rather not" is time they could skip, so a
 * date costing nobody anything goes first. A date everyone is still fine with
 * can come back as it was, and the server keeps its answers.
 */
import type { EventSettings } from "@/lib/eventSearch";
import type { PeopleChoice, SchedulerSettings } from "@/lib/scheduler";
import type { BusyInterval, Participant } from "@/types";

/** A vote's date with the answers on it, as the events list hands it out. */
interface AnsweredDate {
  start: string;
  end: string;
  answers: Record<string, string>;
}

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

/** What Planlæg opens with to search a vote again (#240). */
export interface AgainStart {
  eventId: string;
  /** The members it left out, added now: their calendars are thrown on the pile. */
  add: string[];
  /** Everyone it was for: their calendars lie on the pile already. */
  before: string[];
  /** Its dates and everyone's answers to them. */
  dates: AnsweredDate[];
}

/**
 * The vote's plan as Planlæg's settings (the reverse of settingsToSearch):
 * the same meeting or trip, every month from today, and who it is for now,
 * the members added among them and the rest of the group left out.
 */
export function planFromVote(
  settings: EventSettings,
  invited: string[],
  group: string[],
): { sched: Partial<SchedulerSettings>; people: PeopleChoice } {
  const optional = settings.people?.optional ?? [];
  const people: PeopleChoice = {
    states: Object.fromEntries(
      group.map((id) => [
        id,
        !invited.includes(id) ? "out" : optional.includes(id) ? "optional" : "required",
      ]),
    ),
    atLeast: settings.people?.atLeast ?? null,
  };
  if (settings.kind === "single") {
    return {
      sched: {
        multiDay: false,
        startHour: settings.startHour,
        durationMinutes: settings.durationMinutes,
        anyTime: !!settings.anyTime,
        startWindow: settings.startWindow ?? null,
        dows: settings.allowedDays ?? [0, 1, 2, 3, 4, 5, 6],
        period: null,
      },
      people,
    };
  }
  if (settings.kind === "trip") {
    return {
      sched: {
        multiDay: true,
        startDow: settings.shape.anchorDow,
        days: settings.shape.spanDays,
        period: null,
      },
      people,
    };
  }
  return { sched: { multiDay: true, startDow: null, days: settings.days, period: null }, people };
}
