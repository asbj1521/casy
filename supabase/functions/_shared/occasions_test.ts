import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";

import { EFFECTS, MAX_RECOVERY_DAYS, STRAIN } from "./eventVocabulary.ts";
import { KINDS } from "./labelAi.ts";
import {
  type Occasion,
  OCCASIONS,
  occasionLine,
  occasionNames,
  occasionsBlock,
  usableOccasions,
} from "./occasions.ts";

const DASHES = /[–—]/;

/** What is wrong with an entry, so one failing test names every problem at once. */
function problems(o: Occasion): string[] {
  const out: string[] = [];
  if (!/^[a-z0-9-]+$/.test(o.id)) out.push("id must be lowercase ascii");
  if (o.da.length === 0) out.push("needs a Danish name");
  if (!o.effects.every((e) => (EFFECTS as readonly string[]).includes(e))) out.push("effects");
  if (!(STRAIN as readonly string[]).includes(o.strain)) out.push("strain");
  if (!(KINDS as readonly string[]).includes(o.label)) out.push("label");
  if (o.recoveryDays < 0 || o.recoveryDays > MAX_RECOVERY_DAYS) out.push("recoveryDays");
  if (o.onWeekdays?.some((d) => d < 0 || d > 6)) out.push("onWeekdays");
  if (o.inMonths?.some((m) => m < 1 || m > 12)) out.push("inMonths");
  if (o.vague) {
    if (o.effects.length > 0) out.push("a vague occasion causes nothing");
    if (o.start !== undefined || o.minutes !== undefined) out.push("a vague occasion has no time");
  } else if (o.plan === "meeting") {
    if (o.start === undefined || o.minutes === undefined)
      out.push("a meeting needs start and minutes");
    if (typeof o.start === "number" && (o.start < 0 || o.start > 23)) out.push("start");
    if (o.minutes !== undefined && (o.minutes < 30 || o.minutes > 720 || o.minutes % 30 !== 0)) {
      out.push("minutes: 30 to 720 in steps of 30");
    }
  } else {
    if (!o.days || o.days < 1 || o.days > (o.plan === "trip" ? 7 : 30)) out.push("days");
    if (o.start !== undefined || o.minutes !== undefined) out.push("only meetings have a time");
    if (o.plan === "holiday" && o.startWeekday !== undefined) out.push("holidays start any day");
  }
  if (o.startWeekday !== undefined && o.plan !== "trip") out.push("startWeekday is for trips");
  if ([...o.da, ...o.en, o.note ?? ""].some((s) => DASHES.test(s))) out.push("no long dashes");
  return out;
}

Deno.test("every occasion is within the scheduler's and the vocabulary's limits", () => {
  const bad = OCCASIONS.map((o) => [o.id, problems(o)] as const).filter(([, p]) => p.length > 0);
  assertEquals(bad, []);
});

Deno.test("ids and names are unique across the list", () => {
  const ids = OCCASIONS.map((o) => o.id);
  assertEquals(ids.length, new Set(ids).size);
  const owner = new Map<string, string>();
  const clashes: string[] = [];
  for (const o of OCCASIONS) {
    for (const name of new Set(occasionNames(o))) {
      const other = owner.get(name);
      if (other) clashes.push(`${name}: ${other} and ${o.id}`);
      owner.set(name, o.id);
    }
  }
  assertEquals(clashes, []);
});

Deno.test("drafts never reach a prompt", () => {
  const block = occasionsBlock();
  for (const o of OCCASIONS) {
    assertEquals(block.includes(`- ${o.id} (`), o.status !== "draft", o.id);
  }
  assert(usableOccasions().every((o) => o.status !== "draft"));
});

Deno.test("an occasion's line says what the skills need", () => {
  const julefrokost = OCCASIONS.find((o) => o.id === "julefrokost")!;
  const line = occasionLine(julefrokost);
  assertStringIncludes(line, "julefrokost, julefrokosten");
  assertStringIncludes(line, "meeting from 17 for 7 h");
  assertStringIncludes(line, "Nov-Dec");
  assertStringIncludes(line, "alcohol, lateNight, runs late");
  assertStringIncludes(line, "label party");
  assertStringIncludes(line, "never a lunch at 12");

  const fredagsbar = occasionLine(OCCASIONS.find((o) => o.id === "fredagsbar")!);
  assertStringIncludes(fredagsbar, "on Fri");

  const hygge = occasionLine(OCCASIONS.find((o) => o.id === "hygge")!);
  assertStringIncludes(hygge, "vague");
  assert(!hygge.includes("meeting"));

  const cabin = occasionLine(OCCASIONS.find((o) => o.id === "cabin-weekend")!);
  assertStringIncludes(cabin, "trip of 3 days from Fri");
});

Deno.test("the plan view keeps the timing and leaves out effects and labels", () => {
  const julefrokost = OCCASIONS.find((o) => o.id === "julefrokost")!;
  const line = occasionLine(julefrokost, "plan");
  assertStringIncludes(line, "meeting from 17 for 7 h, Nov-Dec.");
  assertStringIncludes(line, "never a lunch at 12");
  assert(!line.includes("alcohol") && !line.includes("label"));
  assert(occasionsBlock("plan").length < occasionsBlock().length * 0.75);
});
