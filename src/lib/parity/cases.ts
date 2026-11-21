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

/**
 * Every number in `value` to 9 decimals, halves away from zero as Swift's
 * `rounded()`: for answers built with `**`, whose last digit differs between
 * JavaScript engines (Node 22 on CI and Node 25 here wrote the paper pile's
 * timings 1 apart in the 17th digit). Swift rounds its answers the same way.
 */
export function roundedDeep(value: unknown): unknown {
  if (typeof value === "number")
    return (Math.sign(value) * Math.round(Math.abs(value) * 1e9)) / 1e9 || 0;
  if (Array.isArray(value)) return value.map(roundedDeep);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, roundedDeep(v)]));
  return value;
}
