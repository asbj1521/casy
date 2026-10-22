/**
 * Scoring a vote's dates for a group (#119): reads the facts the members'
 * phones shared (ai_day_facts) and runs dayScores.ts over them. Answers only
 * a score per date, never whose facts cost what.
 */
import { type DayFact, impactOn, matchScore, type PlannedProfile } from "./dayScores.ts";
import { EFFECTS, type Effect } from "./eventVocabulary.ts";
import type { Db } from "./supabaseAdmin.ts";

/** Every member of a group, for an event that doesn't name who it is for. */
export async function groupMemberIds(db: Db, groupId: string): Promise<string[]> {
  const { data, error } = await db
    .from("group_members")
    .select("profile_id")
    .eq("group_id", groupId);
  if (error) throw error;
  return (data ?? []).map((m) => m.profile_id as string);
}

/** The facts each member has shared, one list per member in the order given (empty for none). */
export async function factsOfMembers(db: Db, memberIds: string[]): Promise<DayFact[][]> {
  if (memberIds.length === 0) return [];
  const { data, error } = await db
    .from("ai_day_facts")
    .select("profile_id, starts_at, level, avoid, prep_days")
    .in("profile_id", memberIds);
  if (error) throw error;
  const byMember = new Map<string, DayFact[]>();
  for (const row of (data ?? []) as {
    profile_id: string;
    starts_at: string;
    level: "high" | "critical";
    avoid: string[];
    prep_days: number;
  }[]) {
    const list = byMember.get(row.profile_id) ?? [];
    list.push({
      start: Date.parse(row.starts_at),
      level: row.level,
      avoid: EFFECTS.filter((e: Effect) => row.avoid.includes(e)),
      prepDays: row.prep_days,
    });
    byMember.set(row.profile_id, list);
  }
  return memberIds.map((id) => byMember.get(id) ?? []);
}

/**
 * One score per date, 0 to 100, for the members the event is for, and how
 * many of them have shared anything (`counted`): with none, the scores are
 * all 100 and say nothing, and callers show no score.
 */
export async function scoreDates(
  db: Db,
  args: {
    members: string[];
    profile: PlannedProfile | null;
    single: boolean;
    dates: { start: string; end: string }[];
  },
): Promise<{ scores: number[]; counted: number }> {
  const facts = await factsOfMembers(db, args.members);
  return {
    scores: args.dates.map((d) =>
      matchScore(
        impactOn(args.profile, { start: Date.parse(d.start), end: Date.parse(d.end) }, args.single),
        facts,
      ),
    ),
    counted: facts.filter((f) => f.length > 0).length,
  };
}

/** How many dates one ranking may ask about: a search looks at about 60. */
export const MAX_RANKED_DATES = 80;
