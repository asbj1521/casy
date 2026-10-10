/**
 * Eval sets for Casy's AI skills (#111): made-up inputs with the answer they
 * should get, run against the real model with each skill's own prompt,
 * message and answer check (the same skillRequest() the functions use), so
 * a prompt change can be measured before it ships. Run by hand, never in CI:
 * every run costs a little (cents) and needs the API key.
 *
 *   ANTHROPIC_API_KEY=... deno run --node-modules-dir=none --allow-net --allow-env --allow-read \
 *     supabase/evals/run.ts [plan-ai | calendar-categorize]
 *
 * The cases are invented: the repo is public, so no real calendar names,
 * titles or descriptions belong in them. An expected value may be
 * { "oneOf": [...] } where more than one answer is right.
 */
import Anthropic from "npm:@anthropic-ai/sdk@0.132.1";

import { estimateCost, skillRequest, type Usage } from "../functions/_shared/ai.ts";
import {
  buildCategorizeMessage,
  CATEGORIZE_SCHEMA,
  CATEGORIZE_SYSTEM_PROMPT,
  categoriesFromAnswer,
} from "../functions/_shared/categorizeAi.ts";
import {
  buildPlanMessage,
  PLAN_SCHEMA,
  PLAN_SYSTEM_PROMPT,
  planFromAnswer,
  type AiPlan,
} from "../functions/_shared/planAi.ts";

const client = new Anthropic();
const here = new URL(".", import.meta.url);
const load = async (file: string) => JSON.parse(await Deno.readTextFile(new URL(file, here)));

type Expected = unknown;
const isOneOf = (e: Expected): e is { oneOf: unknown[] } =>
  !!e && typeof e === "object" && !Array.isArray(e) && "oneOf" in e;

/** The same answer, lists of plain values in any order, names in any case. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return JSON.stringify(value.map((v) => (typeof v === "string" ? v.toLowerCase() : v)).sort());
  }
  return JSON.stringify(value ?? null);
}
function matches(actual: unknown, expected: Expected): boolean {
  return isOneOf(expected)
    ? expected.oneOf.some((e) => canonical(actual) === canonical(e))
    : canonical(actual) === canonical(expected);
}

interface Result {
  name: string;
  failures: string[];
}

const total: Usage = { input: 0, output: 0 };
async function ask(params: Anthropic.MessageCreateParamsNonStreaming) {
  const answer = await client.messages.create(params);
  total.input += answer.usage.input_tokens;
  total.output += answer.usage.output_tokens;
  const text = answer.content.find((b) => b.type === "text")?.text;
  return { stop: answer.stop_reason, text };
}

/** `run` over `items`, `limit` at a time, results in order. */
async function pool<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await run(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Planning with AI: one call per description.

interface PlanCase {
  name: string;
  lang: "da" | "en";
  text: string;
  /** Settings to check (others aren't), and the special keys below. */
  expect: Record<string, Expected> & {
    /** Asks at least one question (true) or none (false). */
    asks?: boolean;
    /** No plan at all: the text isn't about planning. */
    noPlan?: boolean;
    without?: string[];
    optional?: string[];
  };
}

async function planAi(): Promise<Result[]> {
  const { now, cases } = (await load("plan-ai.json")) as { now: string; cases: PlanCase[] };
  const nowMs = Date.parse(now);
  return await pool(cases, 4, async (c) => {
    const { stop, text } = await ask(
      skillRequest({
        system: PLAN_SYSTEM_PROMPT,
        message: buildPlanMessage({ text: c.text, earlier: [], current: null }, c.lang, nowMs),
        schema: PLAN_SCHEMA,
      }),
    );
    const plan = planFromAnswer(stop, text, nowMs);
    const failures: string[] = [];
    if (c.expect.noPlan) {
      if (plan) failures.push("expected no plan, got one");
      return { name: c.name, failures };
    }
    if (!plan) return { name: c.name, failures: [`no plan (stop_reason ${stop})`] };
    for (const [field, expected] of Object.entries(c.expect)) {
      const actual =
        field === "asks"
          ? plan.questions.length > 0
          : field === "without" || field === "optional"
            ? plan.people[field]
            : plan[field as keyof AiPlan];
      if (!matches(actual, expected)) {
        failures.push(
          `${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        );
      }
    }
    return { name: c.name, failures };
  });
}

// ---------------------------------------------------------------------------
// Sorting calendars: every calendar in one call, as one person's would be.

interface CategorizeCase {
  name: string;
  provider: string;
  titles?: string[];
  /** work, school, personal, other, or null for "unsure". */
  expect: Expected;
}

async function calendarCategorize(): Promise<Result[]> {
  const { cases } = (await load("calendar-categorize.json")) as { cases: CategorizeCase[] };
  const calendars = cases.map((c, i) => ({
    id: `eval-${i}`,
    name: c.name,
    provider: c.provider,
    titles: c.titles ?? [],
  }));
  const { stop, text } = await ask(
    skillRequest({
      system: CATEGORIZE_SYSTEM_PROMPT,
      message: buildCategorizeMessage(calendars),
      schema: CATEGORIZE_SCHEMA,
    }),
  );
  const answers = categoriesFromAnswer(
    stop,
    text,
    calendars.map((c) => c.id),
  );
  return cases.map((c, i) => {
    if (!answers) return { name: c.name, failures: [`no answer (stop_reason ${stop})`] };
    const id = `eval-${i}`;
    if (!answers.has(id)) return { name: c.name, failures: ["not answered"] };
    const actual = answers.get(id);
    return {
      name: c.name,
      failures: matches(actual, c.expect)
        ? []
        : [`expected ${JSON.stringify(c.expect)}, got ${JSON.stringify(actual)}`],
    };
  });
}

// ---------------------------------------------------------------------------

const SETS: Record<string, () => Promise<Result[]>> = {
  "plan-ai": planAi,
  "calendar-categorize": calendarCategorize,
};
const wanted = Deno.args[0] ? [Deno.args[0]] : Object.keys(SETS);
for (const name of wanted) {
  if (!SETS[name]) {
    console.error(`Unknown eval set "${name}". Known: ${Object.keys(SETS).join(", ")}`);
    Deno.exit(1);
  }
  const results = await SETS[name]();
  const passed = results.filter((r) => r.failures.length === 0).length;
  console.log(`\n${name}: ${passed} of ${results.length} passed`);
  for (const r of results) {
    console.log(r.failures.length === 0 ? `  ok   ${r.name}` : `  FAIL ${r.name}`);
    for (const f of r.failures) console.log(`         ${f}`);
  }
}
console.log(
  `\nTokens: ${total.input} in, ${total.output} out; about $${estimateCost(total).toFixed(4)}`,
);
