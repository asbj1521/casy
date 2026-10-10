/**
 * The profile of an event being planned (#113): its name, place, note and
 * planned timing in; what it is likely to cause for the people going out.
 * See _shared/profileAi.ts for what is sent and how the answer is checked.
 *
 * POST { event: EventToProfile } -> { profile, left }
 *
 * The scheduler asks while the event is set up, and sends the profile with
 * the dates (the events function stores it). Nothing is stored here. For
 * anyone the AI features are on for (runSkill checks, and takes one of the
 * person's daily calls for this skill).
 */
import { runSkill } from "../_shared/ai.ts";
import { requireCaller } from "../_shared/auth.ts";
import { HttpError, serve } from "../_shared/http.ts";
import { langOf } from "../_shared/i18n.ts";
import {
  buildProfileMessage,
  PROFILE_SCHEMA,
  PROFILE_SYSTEM_PROMPT,
  profileFromAnswer,
  readProfileRequest,
} from "../_shared/profileAi.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

serve("event-profile", async (req, body) => {
  const db = supabaseAdmin();
  const caller = await requireCaller(req, db);

  const event = readProfileRequest(body.event);
  if (!event) throw new HttpError(400, "event needs a name and a kind");

  const { result: profile, userLeft } = await runSkill(db, caller.id, {
    skill: "event-profile",
    system: PROFILE_SYSTEM_PROMPT,
    message: buildProfileMessage(event, langOf(req)),
    schema: PROFILE_SCHEMA,
    read: profileFromAnswer,
    maxTokens: 2000,
    // Never shown: the scheduler asks in the background, and sends without
    // a profile when it fails.
    messages: {
      usedUp: "Profiling events is used up for today.",
      allUsedUp: "AI is used up for today.",
      unavailable: "Profiling events isn't available right now.",
      unreadable: "Profiling events didn't work this time.",
    },
  });
  return { profile, left: userLeft };
});
