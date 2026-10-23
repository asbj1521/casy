/**
 * Eval sets for Casy's AI skills (#111): made-up inputs with the answer they
 * should get, run against the real model with each skill's own prompt,
 * message and answer check (the same skillRequest() the functions use), so
 * a prompt change can be measured before it ships. Run by hand, never in CI:
 * every run costs a little (cents) and needs the API key.
 *
 *   ANTHROPIC_API_KEY=... deno run --node-modules-dir=none --allow-net --allow-env --allow-read \
 *     supabase/evals/run.ts [plan-ai | calendar-categorize | event-label | event-profile | entries-ai | trip-legs | occasions]
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
  buildLabelMessage,
  LABEL_SCHEMA,
  LABEL_SYSTEM_PROMPT,
  labelsFromAnswer,
  MAX_EVENTS,
  readCorrections,
  readEvent,
  type Correction,
  type EventLabel,
  type EventToLabel,
} from "../functions/_shared/labelAi.ts";
import {
  buildProfileMessage,
  type EventImpact,
  PROFILE_SCHEMA,
  PROFILE_SYSTEM_PROMPT,
  profileFromAnswer,
  readProfileRequest,
} from "../functions/_shared/profileAi.ts";
import {
  buildPlanMessage,
  PLAN_MAX_TOKENS,
  PLAN_SCHEMA,
  PLAN_SYSTEM_PROMPT,
  planFromAnswer,
  searchMonths,
  seasonMonths,
  type AiPlan,
} from "../functions/_shared/planAi.ts";
import {
  buildEntriesMessage,
  type CasyEntry,
  cleanEntries,
  ENTRIES_MAX_TOKENS,
  ENTRIES_SCHEMA,
  ENTRIES_SYSTEM_PROMPT,
  entriesFromAnswer,
  toWire,
} from "../functions/_shared/entries.ts";
import { STRAIN, type Strain } from "../functions/_shared/eventVocabulary.ts";
import {
  buildLegsMessage,
  legsFromAnswer,
  LEGS_SCHEMA,
  LEGS_SYSTEM_PROMPT,
  MAX_EVENTS as MAX_LEG_EVENTS,
  readEvent as readLegEvent,
} from "../functions/_shared/tripLegs.ts";
import { type Occasion, usableOccasions } from "../functions/_shared/occasions.ts";

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
    /** Has a start window (true) or none (false), whatever its hours (#133). */
    window?: boolean;
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
        maxTokens: PLAN_MAX_TOKENS,
      }),
    );
    const plan = planFromAnswer(stop, text, nowMs, { text: c.text, earlier: [], current: null });
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
          : field === "window"
            ? plan.startWindow !== null
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
// Tell Casy (#116): one call per description, the answer read back as the
// dates and clock times the model wrote (toWire), since those are what a
// reader checks.

interface EntriesCase {
  name: string;
  lang: "da" | "en";
  text: string;
  earlier?: string[];
  /** The proposal on screen, as the model writes entries (cleaned into instants here). */
  current?: Record<string, unknown>[];
  expect: {
    /** How many entries come back. */
    count?: number;
    /** The entries in order, each a subset of the fields toWire() gives. */
    entries?: Record<string, Expected>[];
    /** "some": a question or remark; "none": nothing said. */
    message?: "some" | "none";
  };
}

async function entriesAi(): Promise<Result[]> {
  const { now, cases } = (await load("entries-ai.json")) as { now: string; cases: EntriesCase[] };
  const nowMs = Date.parse(now);
  return await pool(cases, 4, async (c) => {
    const current: CasyEntry[] | null = c.current
      ? cleanEntries({ entries: c.current }, nowMs).entries
      : null;
    const { stop, text } = await ask(
      skillRequest({
        system: ENTRIES_SYSTEM_PROMPT,
        message: buildEntriesMessage(
          { text: c.text, earlier: c.earlier ?? [], current },
          c.lang,
          nowMs,
        ),
        schema: ENTRIES_SCHEMA,
        maxTokens: ENTRIES_MAX_TOKENS,
      }),
    );
    const answer = entriesFromAnswer(stop, text, nowMs);
    const failures: string[] = [];
    // Nothing usable is the right answer for text that holds no entry and no remark.
    if (!answer) {
      if (c.expect.count !== 0 || c.expect.message === "some") {
        failures.push(`no answer (stop_reason ${stop})`);
      }
      return { name: c.name, failures };
    }
    if (c.expect.count !== undefined && answer.entries.length !== c.expect.count) {
      failures.push(`count: expected ${c.expect.count}, got ${answer.entries.length}`);
    }
    c.expect.entries?.forEach((expected, i) => {
      const actual = answer.entries[i] ? toWire(answer.entries[i]) : null;
      if (!actual) return failures.push(`entry ${i}: missing`);
      for (const [field, value] of Object.entries(expected)) {
        const got = actual[field as keyof typeof actual];
        if (!matches(got, value)) {
          failures.push(
            `entry ${i} ${field}: expected ${JSON.stringify(value)}, got ${JSON.stringify(got)}`,
          );
        }
      }
    });
    if (c.expect.message === "some" && !answer.message) failures.push("expected a message");
    if (c.expect.message === "none" && answer.message) {
      failures.push(`expected no message, got ${JSON.stringify(answer.message)}`);
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
// Event labels: the cases in batches, as the app sends them.

interface LabelCase {
  event: Partial<EventToLabel> & { title: string };
  /** Label fields to check (others aren't), and the special keys below. */
  expect: Record<string, Expected> & {
    prepAtLeast?: number;
    recoveryAtLeast?: number;
    /** These must be among avoidBefore. */
    avoidIncludes?: string[];
    /** avoidBefore must be empty. */
    noAvoid?: boolean;
    /** The reason must contain none of these (case-insensitive). */
    reasonExcludes?: string[];
  };
}

function labelFailures(label: EventLabel, expect: LabelCase["expect"]): string[] {
  const failures: string[] = [];
  const { prepAtLeast, recoveryAtLeast, avoidIncludes, noAvoid, reasonExcludes, ...fields } =
    expect;
  for (const [field, expected] of Object.entries(fields)) {
    const actual = label[field as keyof EventLabel];
    if (!matches(actual, expected)) {
      failures.push(
        `${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      );
    }
  }
  if (prepAtLeast !== undefined && label.prepDays < prepAtLeast) {
    failures.push(`prepDays: expected at least ${prepAtLeast}, got ${label.prepDays}`);
  }
  if (recoveryAtLeast !== undefined && label.recoveryDays < recoveryAtLeast) {
    failures.push(`recoveryDays: expected at least ${recoveryAtLeast}, got ${label.recoveryDays}`);
  }
  for (const a of avoidIncludes ?? []) {
    if (!label.avoidBefore.includes(a as never)) {
      failures.push(`avoidBefore: expected ${a} in ${JSON.stringify(label.avoidBefore)}`);
    }
  }
  if (noAvoid && label.avoidBefore.length > 0) {
    failures.push(`avoidBefore: expected none, got ${JSON.stringify(label.avoidBefore)}`);
  }
  for (const word of reasonExcludes ?? []) {
    if (label.reason.toLowerCase().includes(word)) {
      failures.push(`reason mentions "${word}": ${JSON.stringify(label.reason)}`);
    }
  }
  return failures;
}

/**
 * The cases in batches, each with `corrections` sent along; results named
 * with `suffix`, so a set with corrections reads apart from one without.
 */
async function labelCases(
  lang: "da" | "en",
  cases: LabelCase[],
  corrections: Correction[],
  suffix: string,
): Promise<Result[]> {
  const events = cases.map((c) => readEvent(c.event)!);
  const batches: number[][] = [];
  for (let i = 0; i < cases.length; i += MAX_EVENTS) {
    batches.push(cases.slice(i, i + MAX_EVENTS).map((_, j) => i + j));
  }
  const answers = await pool(batches, 2, async (indexes) => {
    const { stop, text } = await ask(
      skillRequest({
        system: LABEL_SYSTEM_PROMPT,
        message: buildLabelMessage(
          indexes.map((i) => events[i]),
          lang,
          corrections,
        ),
        schema: LABEL_SCHEMA,
        maxTokens: 12_000,
      }),
    );
    return { stop, labels: labelsFromAnswer(stop, text, indexes.length) };
  });
  return cases.map((c, i) => {
    const batch = Math.floor(i / MAX_EVENTS);
    const { stop, labels } = answers[batch];
    const name = `${c.event.title} (${c.event.calendar ?? ""})${suffix}`;
    if (!labels) return { name, failures: [`no answer (stop_reason ${stop})`] };
    const label = labels[i % MAX_EVENTS];
    if (!label) return { name, failures: ["not answered"] };
    const failures = labelFailures(label, c.expect);
    // The reason, so a run can be read for tone as well as checked.
    if (failures.length > 0) failures.push(`reason: ${label.reason}`);
    return { name, failures };
  });
}

async function eventLabel(): Promise<Result[]> {
  const { lang, cases, withCorrections } = (await load("event-label.json")) as {
    lang: "da" | "en";
    cases: LabelCase[];
    /** Corrections the person made earlier, and cases they should (or shouldn't) reach. */
    withCorrections?: { corrections: unknown[]; cases: LabelCase[] };
  };
  const results = await labelCases(lang, cases, [], "");
  if (!withCorrections) return results;
  const corrections = readCorrections(withCorrections.corrections);
  return [
    ...results,
    ...(await labelCases(lang, withCorrections.cases, corrections, " [with corrections]")),
  ];
}

// ---------------------------------------------------------------------------
// The profile of a planned event: one call per event, as the scheduler asks.

interface ProfileCase {
  event: Record<string, unknown>;
  /** Profile fields to check (others aren't), and the special keys below. */
  expect: Record<string, Expected> & {
    /** These must be among effects. */
    effectsIncludes?: string[];
    /** None of these may be among effects. */
    effectsExcludes?: string[];
    /** effects must be empty. */
    noEffects?: boolean;
    /** The reason must contain none of these (case-insensitive). */
    reasonExcludes?: string[];
  };
}

function profileFailures(profile: EventImpact, expect: ProfileCase["expect"]): string[] {
  const failures: string[] = [];
  const { effectsIncludes, effectsExcludes, noEffects, reasonExcludes, ...fields } = expect;
  for (const [field, expected] of Object.entries(fields)) {
    const actual = profile[field as keyof EventImpact];
    if (!matches(actual, expected)) {
      failures.push(
        `${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      );
    }
  }
  const effects = profile.effects as string[];
  for (const e of effectsIncludes ?? []) {
    if (!effects.includes(e)) failures.push(`effects: expected ${e} in ${JSON.stringify(effects)}`);
  }
  for (const e of effectsExcludes ?? []) {
    if (effects.includes(e))
      failures.push(`effects: expected no ${e}, got ${JSON.stringify(effects)}`);
  }
  if (noEffects && effects.length > 0) {
    failures.push(`effects: expected none, got ${JSON.stringify(effects)}`);
  }
  for (const word of reasonExcludes ?? []) {
    if (profile.reason.toLowerCase().includes(word)) {
      failures.push(`reason mentions "${word}": ${JSON.stringify(profile.reason)}`);
    }
  }
  return failures;
}

async function eventProfile(): Promise<Result[]> {
  const { lang, cases } = (await load("event-profile.json")) as {
    lang: "da" | "en";
    cases: ProfileCase[];
  };
  return await pool(cases, 4, async (c) => {
    const event = readProfileRequest(c.event)!;
    const name = `${event.title} (${event.kind})`;
    const { stop, text } = await ask(
      skillRequest({
        system: PROFILE_SYSTEM_PROMPT,
        message: buildProfileMessage(event, lang),
        schema: PROFILE_SCHEMA,
        maxTokens: 2000,
      }),
    );
    const profile = profileFromAnswer(stop, text);
    if (!profile) return { name, failures: [`no profile (stop_reason ${stop})`] };
    const failures = profileFailures(profile, c.expect);
    if (failures.length > 0) failures.push(`reason: ${profile.reason}`);
    return { name, failures };
  });
}

// ---------------------------------------------------------------------------
// The occasions glossary (#123): every checked occasion asked of each skill
// by its usual name, plus the phrasings in occasions.json, each expected to
// come out as the glossary says (within a step, where a value is a judgement).

const near = (n: number, step: number) => ({ oneOf: [n - step, n, n + step] });
const nearStrain = (s: Strain) => ({
  oneOf: STRAIN.filter((_, i) => Math.abs(i - STRAIN.indexOf(s)) <= 1),
});

/** What Planlæg med AI should make of an occasion. */
function planExpect(o: Occasion, nowMs: number): PlanCase["expect"] {
  if (o.vague) return { asks: true };
  const expect: PlanCase["expect"] = { kind: o.plan };
  if (o.plan === "meeting") {
    // No set time: "any time" and a sensible hour are both right.
    if (typeof o.start === "number") expect.startHour = near(o.start, 1);
    if (o.minutes) expect.durationMinutes = near(o.minutes, 30);
    if (o.onWeekdays) expect.weekdays = o.onWeekdays;
  } else {
    if (o.days) expect.days = near(o.days, 1);
    if (o.startWeekday !== undefined) expect.startWeekday = o.startWeekday;
  }
  if (o.inMonths) {
    expect.monthsWithin = seasonMonths(
      o,
      searchMonths(nowMs).map((m) => m.key),
    );
  }
  return expect;
}

function planFailures(plan: AiPlan | null, expect: PlanCase["expect"], stop: unknown): string[] {
  if (!plan) return [`no plan (stop_reason ${stop})`];
  const failures: string[] = [];
  for (const [field, expected] of Object.entries(expect)) {
    if (field === "monthsWithin") {
      // An occasion's season: the months must lie within it (any part of it).
      const season = expected as { from: string; to: string } | null;
      const m = plan.months;
      const ok =
        season === null
          ? m === null
          : m !== null && m !== "any" && m.from >= season.from && m.to <= season.to;
      if (!ok)
        failures.push(
          `months: expected within ${JSON.stringify(season)}, got ${JSON.stringify(m)}`,
        );
      continue;
    }
    const actual = field === "asks" ? plan.questions.length > 0 : plan[field as keyof AiPlan];
    if (!matches(actual, expected)) {
      failures.push(
        `${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      );
    }
  }
  return failures;
}

async function occasions(): Promise<Result[]> {
  const { now, phrasings } = (await load("occasions.json")) as {
    now: string;
    /** How people actually say an occasion, checked like its name, with `expect` overriding fields. */
    phrasings: { id: string; lang: "da" | "en"; text: string; expect?: PlanCase["expect"] }[];
  };
  const nowMs = Date.parse(now);
  const checked = usableOccasions();
  const byId = new Map(checked.map((o) => [o.id, o]));
  const unknown = phrasings.filter((p) => !byId.has(p.id)).map((p) => p.id);
  if (unknown.length > 0) throw new Error(`occasions.json names unknown or draft ids: ${unknown}`);

  const asPlan = [
    ...checked.map((o) => ({ o, lang: "da" as const, text: o.da[0], expect: {} })),
    ...phrasings.map((p) => ({
      o: byId.get(p.id)!,
      lang: p.lang,
      text: p.text,
      expect: p.expect ?? {},
    })),
  ];
  const plans = await pool(asPlan, 4, async ({ o, lang, text, expect }) => {
    const { stop, text: answer } = await ask(
      skillRequest({
        system: PLAN_SYSTEM_PROMPT,
        message: buildPlanMessage({ text, earlier: [], current: null }, lang, nowMs),
        schema: PLAN_SCHEMA,
        maxTokens: PLAN_MAX_TOKENS,
      }),
    );
    const plan = planFromAnswer(stop, answer, nowMs, { text, earlier: [], current: null });
    return {
      name: `plan: ${text} [${o.id}]`,
      failures: planFailures(plan, { ...planExpect(o, nowMs), ...expect }, stop),
    };
  });

  const profiles = await pool(checked, 4, async (o) => {
    const event = readProfileRequest({
      title: o.da[0],
      kind: o.plan,
      startMinute: typeof o.start === "number" ? o.start * 60 : -1,
      minutes: o.minutes ?? 120,
      days: o.days ?? 1,
    })!;
    const { stop, text } = await ask(
      skillRequest({
        system: PROFILE_SYSTEM_PROMPT,
        message: buildProfileMessage(event, "da"),
        schema: PROFILE_SCHEMA,
        maxTokens: 2000,
      }),
    );
    const profile = profileFromAnswer(stop, text);
    const name = `profile: ${o.da[0]} [${o.id}]`;
    if (!profile) return { name, failures: [`no profile (stop_reason ${stop})`] };
    const failures = profileFailures(
      profile,
      o.vague
        ? { noEffects: true, confidence: "low" }
        : {
            effectsIncludes: o.effects,
            ...(o.effects.length === 0 ? { noEffects: true } : {}),
            runsLate: o.runsLate,
            strain: nearStrain(o.strain),
          },
    );
    if (failures.length > 0) failures.push(`reason: ${profile.reason}`);
    return { name, failures };
  });

  const labels = await labelCases(
    "da",
    checked.map((o) => ({
      event: {
        title: o.da[0],
        calendar: "Kalender",
        startMinute: typeof o.start === "number" ? o.start * 60 : 18 * 60,
        minutes: o.minutes ?? 120,
        ...(o.plan === "meeting" ? {} : { allDay: true, days: o.days ?? 1 }),
      },
      expect: o.vague ? { confidence: "low" } : { kind: o.label },
    })),
    [],
    "",
  );
  return [...plans, ...profiles, ...labels.map((r) => ({ ...r, name: `label: ${r.name}` }))];
}

// ---------------------------------------------------------------------------
// Trip legs (#115): one batch for the whole set, as the app sends them.

interface LegCase {
  event: Record<string, unknown>;
  /** Leg fields to check; cities compared without case. */
  expect: Record<string, Expected>;
}

async function tripLegs(): Promise<Result[]> {
  const { cases } = (await load("trip-legs.json")) as { cases: LegCase[] };
  const events = cases.map((c) => readLegEvent({ calendar: "Kalender", ...c.event })!);
  const batches: number[][] = [];
  for (let i = 0; i < cases.length; i += MAX_LEG_EVENTS) {
    batches.push(cases.slice(i, i + MAX_LEG_EVENTS).map((_, j) => i + j));
  }
  const answers = await pool(batches, 2, async (indexes) => {
    const { stop, text } = await ask(
      skillRequest({
        system: LEGS_SYSTEM_PROMPT,
        message: buildLegsMessage(indexes.map((i) => events[i])),
        schema: LEGS_SCHEMA,
        maxTokens: 6_000,
      }),
    );
    return { stop, legs: legsFromAnswer(stop, text, indexes.length) };
  });
  return cases.map((c, i) => {
    const { stop, legs } = answers[Math.floor(i / MAX_LEG_EVENTS)];
    const name = `${c.event.title} (${c.event.location || "no place"})`;
    if (!legs) return { name, failures: [`no answer (stop_reason ${stop})`] };
    const leg = legs[i % MAX_LEG_EVENTS];
    if (!leg) return { name, failures: ["not answered"] };
    const failures: string[] = [];
    for (const [field, expected] of Object.entries(c.expect)) {
      const actual = leg[field as keyof typeof leg];
      if (!matches(actual, expected)) {
        failures.push(
          `${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        );
      }
    }
    return { name, failures };
  });
}

// ---------------------------------------------------------------------------

const SETS: Record<string, () => Promise<Result[]>> = {
  "plan-ai": planAi,
  "calendar-categorize": calendarCategorize,
  "event-label": eventLabel,
  "event-profile": eventProfile,
  "entries-ai": entriesAi,
  "trip-legs": tripLegs,
  occasions,
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
