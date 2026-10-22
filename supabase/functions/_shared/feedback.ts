/**
 * Learning from use (#122): what people send when the AI got something wrong,
 * checked before it is stored for the project owner to read. Everything is
 * treated as untrusted: each kind is rebuilt from the parts it may have, cut
 * to its length, and refused if it is not what it says.
 *
 * Kinds:
 * - label: the "Forkert?" correction of an event's label (#112): the title and
 *   the calendar's name as sent to the AI, the label it gave, what the person
 *   wrote, and the label it got from that. Never dates, places or other events.
 */
import { cleanLabel, type EventLabel, MAX_NOTE_LENGTH, MAX_TITLE_LENGTH } from "./labelAi.ts";
import { safeName } from "./categorizeAi.ts";
import { cleanText } from "./text.ts";

export interface LabelCorrectionData {
  title: string;
  /** The calendar's name, with emails and links taken out. */
  calendar: string;
  previous: EventLabel;
  note: string;
  label: EventLabel;
}

export type Feedback = { kind: "label"; data: LabelCorrectionData };

/** A label correction, or null if it isn't one. */
export function readLabelCorrection(raw: unknown): LabelCorrectionData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const title = cleanText(r.title, MAX_TITLE_LENGTH);
  const note = cleanText(r.note, MAX_NOTE_LENGTH);
  const previous = cleanLabel(r.previous);
  const label = cleanLabel(r.label);
  if (!title || !note || !previous || !label) return null;
  return {
    title,
    calendar: typeof r.calendar === "string" ? safeName(r.calendar) : "(no name)",
    previous,
    note,
    label,
  };
}

/** What a request sent, as a Feedback, or null if it isn't a kind we take. */
export function readFeedback(body: Record<string, unknown>): Feedback | null {
  if (body.kind === "label") {
    const data = readLabelCorrection(body.data);
    return data ? { kind: "label", data } : null;
  }
  return null;
}

/** The most a person may send in a day, and in all, so nobody can fill the table. */
export const MAX_FEEDBACK_PER_DAY = 40;
export const MAX_FEEDBACK_IN_ALL = 300;
