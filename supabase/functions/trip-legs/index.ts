/**
 * Trip detection (#115): travel events from the iPhone app in, a leg per
 * event out (flight, train, bus or none, and between which cities). See
 * _shared/tripLegs.ts for what is sent and how the answer is checked.
 *
 * POST { events: EventToRead[] } -> { legs: (TripLeg | null)[], left }
 *
 * Nothing is stored or logged: the titles and places go to Anthropic and the
 * legs straight back to the phone, which pairs them into trips and keeps
 * them. Only for people who said yes to the AI using their calendar (#120),
 * and admins and AI testers while it is tested (aiContentAllowed). Each call
 * takes one of the person's daily calls for the skill (runSkill).
 */
import { runSkill } from "../_shared/ai.ts";
import { aiContentAllowed, CONTENT_NOT_ALLOWED } from "../_shared/aiAccess.ts";
import { requireCaller } from "../_shared/auth.ts";
import { HttpError, serve } from "../_shared/http.ts";
import {
  buildLegsMessage,
  LEGS_SCHEMA,
  LEGS_SYSTEM_PROMPT,
  legsFromAnswer,
  readEvents,
} from "../_shared/tripLegs.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

serve("trip-legs", async (req, body) => {
  const db = supabaseAdmin();
  const caller = await requireCaller(req, db);
  if (!(await aiContentAllowed(db, caller.id))) throw new HttpError(403, CONTENT_NOT_ALLOWED);

  const events = readEvents(body.events);
  if (!events) throw new HttpError(400, "events must be 1 to 50 events with titles");

  const { result: legs, userLeft } = await runSkill(db, caller.id, {
    skill: "trip-legs",
    system: LEGS_SYSTEM_PROMPT,
    message: buildLegsMessage(events),
    schema: LEGS_SCHEMA,
    read: (stopReason, text) => legsFromAnswer(stopReason, text, events.length),
    // 50 short legs fit easily; a loop inside the JSON is asked once more.
    maxTokens: 6_000,
    retryIfCutOff: true,
    // Never shown: the app reads legs in the background and only logs a failure.
    messages: {
      usedUp: "Finding trips is used up for today.",
      allUsedUp: "AI is used up for today.",
      unavailable: "Finding trips isn't available right now.",
      unreadable: "Finding trips didn't work this time.",
    },
  });
  return { legs, left: userLeft };
});
