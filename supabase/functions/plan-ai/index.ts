/**
 * Planning with AI (#100): a description of an event, typed or spoken, in;
 * the scheduler's settings (and any questions worth asking) out. See
 * _shared/planAi.ts for what is sent and how the answer is checked.
 *
 * POST { text, earlier?, current? } -> { plan, left }
 *
 * Signed-in people only. Every call takes one of the day's DAILY_AI_CALLS
 * (all callers together, Danish time) before Anthropic is asked, so a failed
 * call still counts: a loop of failures can't run up the bill. `left` is how
 * many remain today, for the page to show.
 */
import Anthropic from "npm:@anthropic-ai/sdk@0.132.1";

import { requireCaller } from "../_shared/auth.ts";
import { requireEnv } from "../_shared/env.ts";
import { HttpError, serve } from "../_shared/http.ts";
import { langOf } from "../_shared/i18n.ts";
import {
  buildPlanMessage,
  DAILY_AI_CALLS,
  PLAN_MODEL,
  PLAN_SCHEMA,
  PLAN_SYSTEM_PROMPT,
  planFromAnswer,
  readPlanRequest,
} from "../_shared/planAi.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

serve("plan-ai", async (req, body) => {
  const db = supabaseAdmin();
  await requireCaller(req, db);

  const request = readPlanRequest(body);
  if (!request) throw new HttpError(400, "Describe the event in a few words.");

  const { data: callId, error: claimError } = await db.rpc("claim_ai_call", {
    p_daily_limit: DAILY_AI_CALLS,
  });
  if (claimError) throw claimError;
  if (callId === null) {
    throw new HttpError(429, "AI planning is used up for today. Plan it by hand, or try tomorrow.");
  }

  const now = Date.now();
  const client = new Anthropic({
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
    // Someone is waiting on the page: one retry, and never long.
    maxRetries: 1,
    timeout: 20_000,
  });

  let answer: Anthropic.Message;
  try {
    answer = await client.messages.create({
      model: PLAN_MODEL,
      max_tokens: 4000,
      // Thinking is billed as output: a short think is plenty for this.
      output_config: { effort: "low", format: { type: "json_schema", schema: PLAN_SCHEMA } },
      system: PLAN_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPlanMessage(request, langOf(req), now) }],
    });
  } catch (err) {
    console.error("plan-ai: Anthropic call failed", err);
    throw new HttpError(
      503,
      "AI planning isn't available right now. Plan it by hand, or try again.",
    );
  }

  // What the call used, for keeping an eye on the cost. Not worth failing over.
  const { error: usageError } = await db
    .from("ai_calls")
    .update({
      input_tokens: answer.usage.input_tokens,
      output_tokens: answer.usage.output_tokens,
    })
    .eq("id", callId);
  if (usageError) console.error("plan-ai: couldn't record usage", usageError);

  const text = answer.content.find((block) => block.type === "text")?.text;
  const plan = planFromAnswer(answer.stop_reason, text, now);
  if (!plan) {
    console.warn(`plan-ai: no plan (stop_reason ${answer.stop_reason})`);
    throw new HttpError(422, "Casy couldn't make an event of that. Try saying it another way.");
  }

  const { data: used, error: countError } = await db.rpc("ai_calls_today");
  if (countError) throw countError;
  return { plan, left: Math.max(0, DAILY_AI_CALLS - (used ?? DAILY_AI_CALLS)) };
});
