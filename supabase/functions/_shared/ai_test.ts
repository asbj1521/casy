import { assertEquals, assertRejects } from "jsr:@std/assert@1";

import {
  aiAllowed,
  estimateCost,
  NOT_ALLOWED,
  GLOBAL_DAILY_AI_CALLS,
  runSkill,
  SKILLS,
  usageSummary,
  type CreateMessage,
  type SkillCall,
} from "./ai.ts";
import { HttpError } from "./http.ts";
import type { Db } from "./supabaseAdmin.ts";

/**
 * A database that answers the claim with `claim`, says whether the person has
 * been allowed AI, and remembers the claim and the usage written.
 */
function fakeDb(claim: unknown, allowed = true) {
  const calls: { rpc?: Record<string, unknown>; usage?: Record<string, unknown>; id?: unknown } =
    {};
  const db = {
    rpc: (_fn: string, args: Record<string, unknown>) => {
      calls.rpc = args;
      return Promise.resolve({ data: claim, error: null });
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: allowed ? { profile_id: "u" } : null, error: null }),
        }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: (_column: string, id: unknown) => {
          calls.usage = values;
          calls.id = id;
          return Promise.resolve({ error: null });
        },
      }),
    }),
  } as unknown as Pick<Db, "rpc" | "from">;
  return { db, calls };
}

const call: SkillCall<string> = {
  skill: "plan-ai",
  system: "system",
  message: "message",
  schema: { type: "object" },
  read: (stop, text) => (stop === "end_turn" && text ? text : null),
  messages: { usedUp: "yours", allUsedUp: "everyone's", unavailable: "down", unreadable: "huh" },
};

const answering =
  (text: string, stop = "end_turn"): CreateMessage =>
  () =>
    Promise.resolve({
      stop_reason: stop,
      content: [{ type: "text", text }],
      usage: { input_tokens: 120, output_tokens: 30, cache_read_input_tokens: 0 },
    } as never);

Deno.test("a call claims the skill's budget for the person, under the ceiling", async () => {
  const { db, calls } = fakeDb({ id: 7, userLeft: 12 });
  const answer = await runSkill(db, "user-1", call, answering("ok"));
  assertEquals(answer, { result: "ok", userLeft: 12 });
  assertEquals(calls.rpc, {
    p_skill: "plan-ai",
    p_profile_id: "user-1",
    p_user_limit: SKILLS["plan-ai"].perPersonPerDay,
    p_global_limit: GLOBAL_DAILY_AI_CALLS,
  });
  assertEquals(calls.id, 7);
  assertEquals(calls.usage, {
    input_tokens: 120,
    output_tokens: 30,
    cache_read_tokens: 0,
    cache_write_tokens: null,
  });
});

Deno.test("a used-up budget says whose, and never asks the model", async () => {
  let asked = false;
  const create: CreateMessage = () => {
    asked = true;
    return answering("ok")({} as never, { maxRetries: 0, timeout: 0 });
  };
  for (const [exhausted, message] of [
    ["user", "yours"],
    ["global", "everyone's"],
  ]) {
    const { db } = fakeDb({ exhausted });
    const err = await assertRejects(() => runSkill(db, "u", call, create), HttpError);
    assertEquals([err.status, err.message], [429, message]);
  }
  assertEquals(asked, false);
});

Deno.test("a failed call or an unreadable answer gets the skill's words", async () => {
  const down: CreateMessage = () => Promise.reject(new Error("network"));
  const failed = await assertRejects(
    () => runSkill(fakeDb({ id: 1, userLeft: 0 }).db, "u", call, down),
    HttpError,
  );
  assertEquals([failed.status, failed.message], [503, "down"]);

  // Still recorded: the call was made and paid for.
  const { db, calls } = fakeDb({ id: 2, userLeft: 0 });
  const unread = await assertRejects(
    () => runSkill(db, "u", call, answering("cut off", "max_tokens")),
    HttpError,
  );
  assertEquals([unread.status, unread.message], [422, "huh"]);
  assertEquals(calls.id, 2);
});

Deno.test("someone waiting gets one quick retry; the background more patience", async () => {
  const seen: { maxRetries: number; timeout: number }[] = [];
  const create: CreateMessage = (params, options) => {
    seen.push(options);
    return answering("ok")(params, options);
  };
  await runSkill(fakeDb({ id: 1, userLeft: 1 }).db, "u", call, create);
  await runSkill(
    fakeDb({ id: 2, userLeft: 1 }).db,
    "u",
    { ...call, skill: "calendar-categorize" },
    create,
  );
  assertEquals(seen, [
    { maxRetries: 1, timeout: 20_000 },
    { maxRetries: 2, timeout: 30_000 },
  ]);
});

Deno.test("the cost estimate follows the list price", () => {
  // A million in and a million out: $0.10 + $0.50.
  assertEquals(estimateCost({ input: 1_000_000, output: 1_000_000 }), 0.6);
  assertEquals(estimateCost({ input: 0, output: 0, cacheRead: 1_000_000 }), 0.01);
});

Deno.test("the usage summary adds up today's calls and prices each skill", () => {
  const usage = usageSummary([
    {
      skill: "calendar-categorize",
      calls_today: 1,
      calls_30d: 4,
      input_tokens_today: 1000,
      output_tokens_today: 200,
      input_tokens_30d: 4000,
      output_tokens_30d: 800,
    },
    {
      skill: "plan-ai",
      calls_today: 3,
      calls_30d: 10,
      input_tokens_today: 0,
      output_tokens_today: 0,
      input_tokens_30d: 1_000_000,
      output_tokens_30d: 0,
    },
  ]);
  assertEquals(usage.today, 4);
  assertEquals(usage.limit, GLOBAL_DAILY_AI_CALLS);
  assertEquals(usage.skills[0].costToday, (1000 * 0.1 + 200 * 0.5) / 1_000_000);
  assertEquals(usage.skills[1].cost30Days, 0.1);
});

Deno.test("someone not allowed AI is refused before anything is claimed or asked", async () => {
  let asked = false;
  const create: CreateMessage = (params, options) => {
    asked = true;
    return answering("ok")(params, options);
  };
  const { db, calls } = fakeDb({ id: 1, userLeft: 1 }, false);
  const err = await assertRejects(() => runSkill(db, "someone", call, create), HttpError);
  assertEquals([err.status, err.message], [403, NOT_ALLOWED]);
  assertEquals([asked, calls.rpc], [false, undefined]);
});

Deno.test("admins may always use AI, with no row of their own", async () => {
  const admin = "11111111-1111-4111-8111-111111111111";
  const before = Deno.env.get("ADMIN_USER_IDS");
  Deno.env.set("ADMIN_USER_IDS", admin);
  try {
    assertEquals(await aiAllowed(fakeDb(null, false).db, admin), true);
    assertEquals(await aiAllowed(fakeDb(null, false).db, "someone-else"), false);
    assertEquals(await aiAllowed(fakeDb(null, true).db, "someone-else"), true);
  } finally {
    if (before === undefined) Deno.env.delete("ADMIN_USER_IDS");
    else Deno.env.set("ADMIN_USER_IDS", before);
  }
});
