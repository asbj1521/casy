/**
 * Event labels (#112), backed by the `calendar-label` Edge Function: this
 * phone's event titles in, a label per event out. The titles go to
 * Anthropic and nowhere else; the server keeps nothing, and the labels are
 * kept on the phone (src/lib/eventLabels.ts). Admins only while #120 is open.
 *
 * The types mirror supabase/functions/_shared/labelAi.ts.
 */
import { currentMessages } from "@/i18n/current";
import { callFunction } from "@/lib/supabaseFunctions";

export type LabelKind =
  | "exam"
  | "deadline"
  | "presentation"
  | "interview"
  | "lecture"
  | "study"
  | "work"
  | "shift"
  | "meeting"
  | "appointment"
  | "flight"
  | "travel"
  | "stay"
  | "wedding"
  | "funeral"
  | "birthday"
  | "party"
  | "dinner"
  | "social"
  | "sport"
  | "competition"
  | "show"
  | "vacation"
  | "family"
  | "chores"
  | "reminder"
  | "other"
  | "unclear";

export type LabelAvoid = "lateNight" | "alcohol" | "travel" | "exercise";

export interface EventLabel {
  kind: LabelKind;
  importance: "low" | "normal" | "high" | "critical";
  /** Days before it needed to prepare. */
  prepDays: number;
  /** What shouldn't happen the evening or day before it. */
  avoidBefore: LabelAvoid[];
  /** Days after it likely needed to recover. */
  recoveryDays: number;
  strain: "none" | "light" | "moderate" | "heavy";
  confidence: "low" | "medium" | "high";
  /** One line, in the language Casy was used in when it was labelled. */
  reason: string;
}

/** One distinct event, as sent. */
export interface EventToLabel {
  title: string;
  calendar: string;
  allDay: boolean;
  /** Minutes after midnight, Danish time (timed events). */
  startMinute: number;
  /** Length in minutes (timed events). */
  minutes: number;
  /** Days spanned (all-day events). */
  days: number;
  /** How often it occurs. */
  count: number;
}

interface LabelAnswer {
  /** One per event sent, in order; null where it couldn't be labelled. */
  labels: (EventLabel | null)[];
  left: number;
}

/** One of the person's earlier corrections, sent so it carries over to events like it. */
export interface SentCorrection {
  title: string;
  calendar: string;
  note: string;
  label: EventLabel;
}

/** Label up to 50 events, in the background, with the person's corrections in hand. */
export async function labelEvents(
  events: EventToLabel[],
  corrections: SentCorrection[],
): Promise<LabelAnswer> {
  return await callFunction<LabelAnswer>("calendar-label", { body: { events, corrections } });
}

/** Label one event again, from the person's note on what was wrong ("Forkert?"). */
export async function relabelEvent(
  event: EventToLabel,
  previous: EventLabel,
  note: string,
  corrections: SentCorrection[],
): Promise<EventLabel> {
  const { labels } = await callFunction<LabelAnswer>("calendar-label", {
    body: { events: [event], correction: { note, previous }, corrections },
    errorMessage: currentMessages().api.relabel,
  });
  const label = labels[0];
  if (!label) throw new Error(currentMessages().api.relabel);
  return label;
}
