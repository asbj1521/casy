/**
 * Ideas for a stretch a whole group is free (#171, Tid til hinanden): what
 * the group could do with the time. See _shared/ideasAi.ts for what is sent
 * and how the answer is checked.
 *
 * POST { stretch: StretchToFill } -> { ideas, left }
 *
 * Asked when someone opens a starred day on the home page; nothing is
 * stored. For anyone the AI features are on for (runSkill checks, and takes
 * one of the person's daily calls for this skill).
 */
import { runSkill } from "../_shared/ai.ts";
import { requireCaller } from "../_shared/auth.ts";
import { HttpError, serve } from "../_shared/http.ts";
import { langOf } from "../_shared/i18n.ts";
import {
  buildIdeasMessage,
  IDEAS_SCHEMA,
  IDEAS_SYSTEM_PROMPT,
  ideasFromAnswer,
  readIdeasRequest,
} from "../_shared/ideasAi.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

serve("prime-ideas", async (req, body) => {
  const db = supabaseAdmin();
  const caller = await requireCaller(req, db);

  const stretch = readIdeasRequest(body.stretch);
  if (!stretch) throw new HttpError(400, "That free time isn't valid.");

  const { result: ideas, userLeft } = await runSkill(db, caller.id, {
    skill: "prime-ideas",
    system: IDEAS_SYSTEM_PROMPT,
    message: buildIdeasMessage(stretch, langOf(req)),
    schema: IDEAS_SCHEMA,
    read: ideasFromAnswer,
    maxTokens: 1500,
    retryIfCutOff: true,
    // Never shown: the sheet simply goes without ideas when they fail.
    messages: {
      usedUp: "Ideas are used up for today.",
      allUsedUp: "AI is used up for today.",
      unavailable: "Ideas aren't available right now.",
      unreadable: "Ideas didn't work this time.",
    },
  });
  return { ideas, left: userLeft };
});
