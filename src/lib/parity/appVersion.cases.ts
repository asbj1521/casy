/** appVersion.ts's rule, for AppVersion.swift (#202: the app asks itself whether it is too old). */
import { isOutdated, parseVersion } from "@/lib/appVersion";

import { caseBook, type ParityCase } from "./cases";

const VERSIONS = [
  "1.2.3",
  "1.2",
  "0.0.0",
  " 2.0.1 ",
  "10.0.0",
  "1.2.3.4",
  "1.x",
  "",
  "v1.2.3",
  "01.02.03",
];

const PAIRS: [string, string | null][] = [
  ["1.2.3", null],
  ["1.2.3", "1.2.3"],
  ["1.2.3", "1.2.4"],
  ["1.2.3", "1.3"],
  ["1.10.0", "1.9.9"],
  ["1.9.9", "1.10.0"],
  ["2.0", "1.99.99"],
  ["0.9.0", "1.0"],
  ["1.2.3", "typo"],
  ["dev", "1.0.0"],
  ["1.0.0", ""],
];

export function appVersionCases(): ParityCase[] {
  const { cases, add } = caseBook(20261127);
  for (const version of VERSIONS) add("parse", { version }, parseVersion(version));
  for (const [current, minimum] of PAIRS)
    add("outdated", { current, minimum }, isOutdated(current, minimum));
  return cases;
}
