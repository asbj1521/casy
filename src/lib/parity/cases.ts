/** What every module's parity cases are made of (docs/native-ios-plan.md). */
import { seededRandom } from "./random";

export interface ParityCase {
  name: string;
  input: { fn: string; args: Record<string, unknown> };
  output: unknown;
}

/** A list of named cases (an argument list asked twice is kept once) and a seeded dice. */
export function caseBook(seed: number) {
  const random = seededRandom(seed);
  const int = (low: number, high: number) => low + Math.floor(random() * (high - low + 1));
  const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)];
  const cases: ParityCase[] = [];
  const seen = new Set<string>();
  const add = (fn: string, args: Record<string, unknown>, output: unknown) => {
    const name = `${fn} ${JSON.stringify(args)}`;
    if (seen.has(name)) return;
    seen.add(name);
    cases.push({ name, input: { fn, args }, output: output ?? null });
  };
  return { cases, add, int, pick, random };
}
