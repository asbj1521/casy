/**
 * Event labels (#112): event titles from the iPhone app in, a label per
 * event out (what it is, how much it matters, what to avoid before it). See
 * _shared/labelAi.ts for what is sent and how the answer is checked.
 *
 * POST { events: EventToLabel[] } -> { labels: (EventLabel | null)[], left }
 * POST { events: [one], correction: { note, previous } } -> the same, for one
 *   event the person said was labelled wrong ("Forkert?"), with what they wrote.
 *
 * Nothing is stored or logged: the titles go to Anthropic and the labels
 * straight back to the phone, which keeps them. Until #120 (the consent and
 * privacy policy for sending titles) is done: admins, and people an admin
 * switched labels on for (eventLabelsAllowed). Each call takes one of the
 * person's daily calls for its skill (runSkill), which also checks AI is on.
 */
import { runSkill } from "../_shared/ai.ts";
import { eventLabelsAllowed, LABELS_NOT_ALLOWED } from "../_shared/aiAccess.ts";
import { requireCaller } from "../_shared/auth.ts";
import { HttpError, serve } from "../_shared/http.ts";
import { langOf } from "../_shared/i18n.ts";
import {
  buildLabelMessage,
  buildRelabelMessage,
  cleanLabel,
  LABEL_SCHEMA,
  LABEL_SYSTEM_PROMPT,
  labelsFromAnswer,
  MAX_NOTE_LENGTH,
  readEvents,
} from "../_shared/labelAi.ts";
import { cleanText } from "../_shared/text.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

serve("calendar-label", async (req, body) => {
  const db = supabaseAdmin();
  const caller = await requireCaller(req, db);
  if (!(await eventLabelsAllowed(db, caller.id))) throw new HttpError(403, LABELS_NOT_ALLOWED);

  const events = readEvents(body.events);
  if (!events) throw new HttpError(400, "events must be 1 to 50 events with titles");
  const lang = langOf(req);

  if (body.correction !== undefined) {
    const correction = body.correction as { note?: unknown; previous?: unknown } | null;
    const note = cleanText(correction?.note, MAX_NOTE_LENGTH);
    const previous = cleanLabel(correction?.previous);
    if (events.length !== 1 || !previous) {
      throw new HttpError(400, "a correction needs one event and its previous label");
    }
    if (!note) throw new HttpError(400, "Write what is wrong with the label.");
    const { result: labels, userLeft } = await runSkill(db, caller.id, {
      skill: "event-relabel",
      system: LABEL_SYSTEM_PROMPT,
      message: buildRelabelMessage(events[0], previous, note, lang),
      schema: LABEL_SCHEMA,
      read: (stopReason, text) => {
        const answer = labelsFromAnswer(stopReason, text, 1);
        return answer?.[0] ? answer : null;
      },
      messages: {
        usedUp: "You've corrected labels as many times as you can today. Try again tomorrow.",
        allUsedUp: "AI is used up for today. Try again tomorrow.",
        unavailable: "Casy couldn't label it again right now. Try again.",
        unreadable: "Casy couldn't label it again this time. Try saying it another way.",
      },
    });
    return { labels, left: userLeft };
  }

  const { result: labels, userLeft } = await runSkill(db, caller.id, {
    skill: "event-label",
    system: LABEL_SYSTEM_PROMPT,
    message: buildLabelMessage(events, lang),
    schema: LABEL_SCHEMA,
    read: (stopReason, text) => labelsFromAnswer(stopReason, text, events.length),
    // A batch of 50 labels is a few thousand tokens of answer.
    maxTokens: 12_000,
    // Never shown: the app labels in the background and only logs a failure.
    messages: {
      usedUp: "Labelling events is used up for today.",
      allUsedUp: "AI is used up for today.",
      unavailable: "Labelling events isn't available right now.",
      unreadable: "Labelling events didn't work this time.",
    },
  });
  return { labels, left: userLeft };
});
