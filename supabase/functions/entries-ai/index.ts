/**
 * Tell Casy (#116): a description of time that is in no calendar, typed or
 * spoken, in; entries for the person's own Casy calendar out, for them to
 * check before anything is saved (calendar-entries). See _shared/entries.ts
 * for what is sent and how the answer is checked.
 *
 * POST { text, earlier?, current? } -> { entries, message, left }
 *
 * Signed-in people only. Each call takes one of the person's daily calls
 * for this skill (runSkill in _shared/ai.ts), before Anthropic is asked.
 * Nothing is stored here: the entries come back as a proposal.
 */
import { requireCaller } from "../_shared/auth.ts";
import { runSkill } from "../_shared/ai.ts";
import {
  buildEntriesMessage,
  ENTRIES_MAX_TOKENS,
  ENTRIES_SCHEMA,
  ENTRIES_SYSTEM_PROMPT,
  entriesFromAnswer,
  readEntriesRequest,
} from "../_shared/entries.ts";
import { HttpError, serve } from "../_shared/http.ts";
import { langOf } from "../_shared/i18n.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

serve("entries-ai", async (req, body) => {
  const db = supabaseAdmin();
  const caller = await requireCaller(req, db);

  const now = Date.now();
  const request = readEntriesRequest(body, now);
  if (!request) throw new HttpError(400, "Say when you're away or busy in a few words.");

  const { result, userLeft } = await runSkill(db, caller.id, {
    skill: "entries-ai",
    system: ENTRIES_SYSTEM_PROMPT,
    message: buildEntriesMessage(request, langOf(req), now),
    schema: ENTRIES_SCHEMA,
    read: (stopReason, text) => entriesFromAnswer(stopReason, text, now),
    maxTokens: ENTRIES_MAX_TOKENS,
    retryIfCutOff: true,
    messages: {
      usedUp: "You've told Casy as much as you can today. Try again tomorrow.",
      allUsedUp: "AI is used up for today. Try again tomorrow.",
      unavailable: "Casy couldn't read that right now. Try again.",
      unreadable: "Casy couldn't make a calendar entry of that. Try saying it another way.",
    },
  });
  return { entries: result.entries, message: result.message, left: userLeft };
});
