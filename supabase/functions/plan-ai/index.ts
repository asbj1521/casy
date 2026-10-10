/**
 * Planning with AI (#100): a description of an event, typed or spoken, in;
 * the scheduler's settings (and any questions worth asking) out. See
 * _shared/planAi.ts for what is sent and how the answer is checked.
 *
 * POST { text, earlier?, current? } -> { plan, left }
 *
 * Signed-in people only. Each call takes one of the person's daily calls
 * for this skill (runSkill in _shared/ai.ts), before Anthropic is asked.
 * `left` is how many they have left today, for the page to show.
 */
import { requireCaller } from "../_shared/auth.ts";
import { runSkill } from "../_shared/ai.ts";
import { HttpError, serve } from "../_shared/http.ts";
import { langOf } from "../_shared/i18n.ts";
import {
  buildPlanMessage,
  PLAN_SCHEMA,
  PLAN_SYSTEM_PROMPT,
  planFromAnswer,
  readPlanRequest,
} from "../_shared/planAi.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

serve("plan-ai", async (req, body) => {
  const db = supabaseAdmin();
  const caller = await requireCaller(req, db);

  const request = readPlanRequest(body);
  if (!request) throw new HttpError(400, "Describe the event in a few words.");

  const now = Date.now();
  const { result: plan, userLeft } = await runSkill(db, caller.id, {
    skill: "plan-ai",
    system: PLAN_SYSTEM_PROMPT,
    message: buildPlanMessage(request, langOf(req), now),
    schema: PLAN_SCHEMA,
    read: (stopReason, text) => planFromAnswer(stopReason, text, now),
    messages: {
      usedUp: "You've used all your AI planning for today. Plan it by hand, or try tomorrow.",
      allUsedUp: "AI planning is used up for today. Plan it by hand, or try tomorrow.",
      unavailable: "AI planning isn't available right now. Plan it by hand, or try again.",
      unreadable: "Casy couldn't make an event of that. Try saying it another way.",
    },
  });
  return { plan, left: userLeft };
});
