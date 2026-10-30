/**
 * What the comfort rules (#178, dateComfort.ts) found about a date, as
 * sentences for the pile's date details: only what matters (a penalty of
 * half a MEDIUM or more for a person, or one of the date's own), the people
 * named, you first, as the edge warnings do. What the edge warnings already
 * say (earlyMorning.ts: back to back, an early morning after 23:00, New
 * Year's Day) is left out, so a date never says it twice.
 */
import type { Lang } from "@/i18n/locale";
import { type Penalty, type Rule, MEDIUM } from "@/lib/dateComfort";
import type { EdgeWarning } from "@/lib/earlyMorning";
import { nameList } from "@/lib/format";

/** The least a person's penalty for a rule must be to be said. */
const SAID_FROM = MEDIUM / 2;

/** The words comfortNotes needs (t.planFromCalendar.comfort). */
export interface ComfortWords {
  you: string;
  tightBefore: (who: string) => string;
  tightAfter: (who: string) => string;
  squeezed: (who: string) => string;
  earlyAfterLate: (who: string) => string;
  schoolNight: string;
  afterDark: string;
  familyDay: string;
  longWeekend: string;
  soon: string;
  farAhead: string;
}

/** A sentence, and whether it is a mark against the date (a bonus is not). */
export interface ComfortNote {
  text: string;
  notable: boolean;
}

const PEOPLE_RULES = ["squeezed", "tightBefore", "tightAfter", "earlyAfterLate"] as const;

export function comfortNotes(
  penalties: Penalty[],
  {
    nameOf,
    youId,
    lang,
    words,
    warnings,
  }: {
    nameOf: (profileId: string) => string;
    youId: string | null;
    lang: Lang;
    words: ComfortWords;
    warnings: EdgeWarning[] | null;
  },
): ComfortNote[] {
  const notes: ComfortNote[] = [];
  const has = (kind: EdgeWarning["kind"]) => !!warnings?.some((w) => w.kind === kind);

  // Per person: what each rule cost them, summed.
  const costs = new Map<Rule, Map<string, number>>();
  for (const p of penalties) {
    if (p.who === undefined) continue;
    const people = costs.get(p.rule) ?? new Map<string, number>();
    people.set(p.who, (people.get(p.who) ?? 0) + p.points);
    costs.set(p.rule, people);
  }
  // Squeezed says what tight before and after would, for the same person.
  const squeezed = new Set(
    [...(costs.get("sandwiched") ?? [])].filter(([, v]) => v >= SAID_FROM).map(([id]) => id),
  );
  const who = (rule: (typeof PEOPLE_RULES)[number]) => {
    const ids = [...(costs.get(rule === "squeezed" ? "sandwiched" : rule) ?? [])]
      .filter(
        ([id, v]) =>
          v >= SAID_FROM &&
          !(squeezed.has(id) && (rule === "tightBefore" || rule === "tightAfter")),
      )
      .map(([id]) => id)
      .sort((a, b) => Number(b === youId) - Number(a === youId));
    return {
      list: nameList(
        ids.map((id) => (id === youId ? words.you : nameOf(id))),
        lang,
      ),
      none: ids.length === 0,
    };
  };
  for (const rule of PEOPLE_RULES) {
    // Back to back, and the morning after, are already said by the warnings.
    if (rule === "earlyAfterLate" && has("earlyMorning")) continue;
    if ((rule === "tightBefore" || rule === "squeezed") && has("backToBack")) continue;
    const found = who(rule);
    if (!found.none) notes.push({ text: words[rule](found.list), notable: true });
  }

  // About the date itself.
  const sum = (rule: Rule) =>
    penalties.filter((p) => p.rule === rule).reduce((s, p) => s + p.points, 0);
  if (sum("schoolNight") > 0) notes.push({ text: words.schoolNight, notable: true });
  if (sum("afterDark") > 0) notes.push({ text: words.afterDark, notable: true });
  if (sum("dayOfYear") > 0 && !has("newYearsDay"))
    notes.push({ text: words.familyDay, notable: true });
  if (sum("dayOfYear") < 0) notes.push({ text: words.longWeekend, notable: false });
  if (sum("notice") > 0) notes.push({ text: words.soon, notable: true });
  if (sum("farAhead") >= SAID_FROM) notes.push({ text: words.farAhead, notable: false });
  return notes;
}
