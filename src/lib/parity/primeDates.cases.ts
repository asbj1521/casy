/** primeDates.ts's stars for the home page, for Prime.swift (#202: found natively). */
import { pickPrimeDates, primeCandidates, type PrimeDate, type PrimeGroup } from "@/lib/primeDates";
import { addDays, APP_TIME_ZONE, atHour } from "@/lib/zone";

import { caseBook, roundedDeep, type ParityCase } from "./cases";

const TZ = APP_TIME_ZONE;
const iso = (ms: number) => new Date(ms).toISOString();

export function primeDatesCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261126);
  // Mornings around the year, Christmas and summer time's changes among them.
  const nows = [
    Date.UTC(2026, 9, 7, 8),
    Date.UTC(2026, 11, 10, 9),
    Date.UTC(2027, 2, 20, 7),
    Date.UTC(2026, 5, 1, 12),
  ];
  const groups: PrimeGroup[] = [];
  for (let i = 0; i < 70; i++) {
    const now = pick(nows);
    const size = int(2, 6);
    const memberIds = Array.from({ length: size }, (_, m) => `p${m}`);
    // From almost empty weeks to crowded ones, so some days and weekends are wholly free.
    const crowd = pick([0, 2, 8, 25]);
    const busy: PrimeGroup["busy"] = {};
    for (const id of memberIds) {
      busy[id] = Array.from({ length: int(0, crowd) }, () => {
        const day = addDays(now, int(-1, 24), TZ);
        const start = atHour(day, int(6, 22) + pick([0, 0.25, 0.5]), TZ);
        return { start: iso(start), end: iso(start + int(1, 10) * 1_800_000) };
      });
    }
    const connected = Object.fromEntries(memberIds.map((id) => [id, random() > 0.04]));
    const eventDates =
      random() < 0.3
        ? [
            {
              start: iso(atHour(addDays(now, int(1, 22), TZ), 18, TZ)),
              end: iso(atHour(addDays(now, int(1, 22), TZ), 21, TZ)),
            },
          ]
        : [];
    const group: PrimeGroup = {
      id: `g${i}`,
      memberIds,
      busy,
      connected,
      eventDates,
      voting: random() < 0.08,
    };
    groups.push(group);
    add("primeCandidates", { group, now }, primeCandidates(group, now, TZ));
  }

  // Several groups' candidates at once, with and without day scores.
  for (let i = 0; i < 30; i++) {
    const now = pick(nows);
    const lists: PrimeDate[][] = Array.from({ length: int(1, 4) }, () =>
      primeCandidates(pick(groups), now, TZ).map((p, k) => ({
        ...p,
        groupId: `${p.groupId}-${k % 2}`,
      })),
    );
    const scores: Record<string, Record<string, number>> = {};
    if (random() < 0.6) {
      for (const p of lists.flat()) {
        if (random() < 0.5) (scores[p.groupId] ??= {})[String(p.start)] = int(20, 100);
      }
    }
    const asMap = new Map(
      Object.entries(scores).map(([g, s]) => [
        g,
        new Map(Object.entries(s).map(([k, v]) => [Number(k), v])),
      ]),
    );
    add("pickPrimeDates", { candidates: lists, scores }, pickPrimeDates(lists, asMap));
  }
  return cases.map((c) => ({ ...c, output: roundedDeep(c.output) }));
}
