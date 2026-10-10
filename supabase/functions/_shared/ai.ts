/**
 * Casy's AI skills (#111): every call to Anthropic goes through runSkill(),
 * so each skill only brings what is its own (its prompt, its answer's shape,
 * how the answer is read, its words for failure) and shares the rest:
 *
 *  - a daily budget per person and skill, under one ceiling for all calls
 *    together that protects the bill (claim_ai_skill_call, ai_budgets
 *    migration). A call is claimed before Anthropic is asked, so a failed
 *    call counts too: a loop of failures can't run up the bill;
 *  - the call itself: Claude Haiku, effort low, a JSON schema for the answer;
 *  - what it used, recorded on its row (tokens only, never text);
 *  - one set of answers for what goes wrong.
 *
 * A skill's text is built by its own module (planAi.ts, categorizeAi.ts),
 * which says what is sent and treats the answer as untrusted input.
 */
import Anthropic from "npm:@anthropic-ai/sdk@0.132.1";

import { requireEnv } from "./env.ts";
import { HttpError } from "./http.ts";
import type { Db } from "./supabaseAdmin.ts";

export const AI_MODEL = "claude-haiku-5-5";

/** Every call together, per day in Danish time: the ceiling over all budgets. */
export const GLOBAL_DAILY_AI_CALLS = 500;

export type Skill = "plan-ai" | "calendar-categorize";

/**
 * Each skill's budget, and whether someone is waiting on the page (one quick
 * retry) or it runs in the background (more patience).
 */
export const SKILLS: Record<Skill, { perPersonPerDay: number; waiting: boolean }> = {
  "plan-ai": { perPersonPerDay: 30, waiting: true },
  // Runs once per new calendar; more than a few a day means something loops.
  "calendar-categorize": { perPersonPerDay: 5, waiting: false },
};

/**
 * Haiku 5.5's list price in dollars per million tokens, for the admin
 * overview's estimate: input and output, cache reads at a tenth of input and
 * cache writes at 1.25 times it.
 */
export const PRICE_PER_MILLION = { input: 0.1, output: 0.5 };

export interface Usage {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
}

/** What a number of tokens costs, in dollars (an estimate from list prices). */
export function estimateCost(usage: Usage): number {
  const { input, output } = PRICE_PER_MILLION;
  return (
    (usage.input * input +
      usage.output * output +
      (usage.cacheRead ?? 0) * input * 0.1 +
      (usage.cacheWrite ?? 0) * input * 1.25) /
    1_000_000
  );
}

/** What a skill says when it fails, in English (translated in i18n.ts). */
export interface SkillMessages {
  /** This person used their calls for the skill today. */
  usedUp: string;
  /** Every call for today is taken, by everyone together. */
  allUsedUp: string;
  /** Anthropic couldn't be reached, or answered with an error. */
  unavailable: string;
  /** The answer couldn't be read as the skill's answer. */
  unreadable: string;
}

export interface SkillCall<T> {
  skill: Skill;
  system: string;
  message: string;
  schema: Record<string, unknown>;
  /** The skill's answer from the model's, or null if it can't be read. */
  read: (stopReason: string | null, text: string | undefined) => T | null;
  messages: SkillMessages;
  maxTokens?: number;
}

/** What the model is asked, so a test can stand in for Anthropic. */
export type CreateMessage = (
  params: Anthropic.MessageCreateParamsNonStreaming,
  options: { maxRetries: number; timeout: number },
) => Promise<Anthropic.Message>;

const anthropic: CreateMessage = (params, options) =>
  new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY"), ...options }).messages.create(params);

type Claim = { id: number; userLeft: number } | { exhausted: "user" | "global" };

/**
 * Run one skill for `profileId`: claim a call, ask the model, record what
 * it used, and read the answer. Throws an HttpError with the skill's words
 * for every way it can fail; `userLeft` is how many of the skill's calls the
 * person has left today.
 */
export async function runSkill<T>(
  db: Pick<Db, "rpc" | "from">,
  profileId: string,
  call: SkillCall<T>,
  create: CreateMessage = anthropic,
): Promise<{ result: T; userLeft: number }> {
  const budget = SKILLS[call.skill];
  const { data, error } = await db.rpc("claim_ai_skill_call", {
    p_skill: call.skill,
    p_profile_id: profileId,
    p_user_limit: budget.perPersonPerDay,
    p_global_limit: GLOBAL_DAILY_AI_CALLS,
  });
  if (error) throw error;
  const claim = data as Claim;
  if ("exhausted" in claim) {
    throw new HttpError(
      429,
      claim.exhausted === "user" ? call.messages.usedUp : call.messages.allUsedUp,
    );
  }

  let answer: Anthropic.Message;
  try {
    answer = await create(
      {
        model: AI_MODEL,
        max_tokens: call.maxTokens ?? 4000,
        // Thinking is billed as output: a short think is plenty for these.
        output_config: { effort: "low", format: { type: "json_schema", schema: call.schema } },
        system: call.system,
        messages: [{ role: "user", content: call.message }],
      },
      budget.waiting ? { maxRetries: 1, timeout: 20_000 } : { maxRetries: 2, timeout: 30_000 },
    );
  } catch (err) {
    console.error(`${call.skill}: Anthropic call failed`, err);
    throw new HttpError(503, call.messages.unavailable);
  }

  // What the call used, for the cost. Not worth failing the answer over.
  const { error: usageError } = await db
    .from("ai_calls")
    .update({
      input_tokens: answer.usage.input_tokens,
      output_tokens: answer.usage.output_tokens,
      cache_read_tokens: answer.usage.cache_read_input_tokens ?? null,
      cache_write_tokens: answer.usage.cache_creation_input_tokens ?? null,
    })
    .eq("id", claim.id);
  if (usageError) console.error(`${call.skill}: couldn't record usage`, usageError);

  const text = answer.content.find((block) => block.type === "text")?.text;
  const result = call.read(answer.stop_reason, text);
  if (result === null) {
    console.warn(`${call.skill}: answer couldn't be read (stop_reason ${answer.stop_reason})`);
    throw new HttpError(422, call.messages.unreadable);
  }
  return { result, userLeft: claim.userLeft };
}
