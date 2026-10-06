/**
 * Danish public holidays, computed from their rules instead of fetched.
 *
 * Almost every Danish holiday is a fixed date or a fixed offset from Easter,
 * so there is no data source to go stale, no account to connect and no network
 * call: give it a year, get that year's days. The days are worked out as
 * plain calendar dates, then placed at midnight in the zone given (Danish
 * time on My calendar), never the browser's own.
 */
import { wallTime } from "@/lib/zone";

export interface Holiday {
  /** Midnight at the start of the day, in the zone the holidays were asked for. */
  date: Date;
  /** Local day as "YYYY-MM-DD". */
  key: string;
  /** Danish name, as shown on the calendar. */
  name: string;
  englishName: string;
  /**
   * "public" days are official helligdage. "observed" days are not official
   * holidays but are widely taken off or treated as one.
   */
  kind: "public" | "observed";
}

/**
 * Easter Sunday (Gregorian) as a calendar date, `month` 0-based: the
 * Meeus/Jones/Butcher algorithm.
 */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month: month - 1, day };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Store Bededag (Great Prayer Day) was abolished as a public holiday from 2024. */
const LAST_STORE_BEDEDAG_YEAR = 2023;

/** All Danish holidays in `year`, sorted by date, each at midnight in `timeZone`. */
export function danishHolidays(year: number, timeZone: string): Holiday[] {
  const easter = easterSunday(year);
  // A calendar date as [month, day]; Date.UTC normalises day overflow
  // (Easter plus 50 days runs into May or June), with no clock involved.
  const date = (month: number, day: number): [number, number] => {
    const d = new Date(Date.UTC(year, month, day));
    return [d.getUTCMonth(), d.getUTCDate()];
  };
  const afterEaster = (days: number) => date(easter.month, easter.day + days);

  const rules: Array<[[number, number], string, string, Holiday["kind"]]> = [
    [date(0, 1), "Nytårsdag", "New Year's Day", "public"],
    [afterEaster(-3), "Skærtorsdag", "Maundy Thursday", "public"],
    [afterEaster(-2), "Langfredag", "Good Friday", "public"],
    [afterEaster(0), "Påskedag", "Easter Sunday", "public"],
    [afterEaster(1), "2. påskedag", "Easter Monday", "public"],
    [afterEaster(39), "Kristi Himmelfartsdag", "Ascension Day", "public"],
    [afterEaster(49), "Pinsedag", "Whit Sunday", "public"],
    [afterEaster(50), "2. pinsedag", "Whit Monday", "public"],
    [date(5, 5), "Grundlovsdag", "Constitution Day", "observed"],
    [date(11, 24), "Juleaften", "Christmas Eve", "observed"],
    [date(11, 25), "Juledag", "Christmas Day", "public"],
    [date(11, 26), "2. juledag", "Boxing Day", "public"],
    [date(11, 31), "Nytårsaften", "New Year's Eve", "observed"],
  ];
  if (year <= LAST_STORE_BEDEDAG_YEAR) {
    rules.push([afterEaster(26), "Store bededag", "Great Prayer Day", "public"]);
  }

  return rules
    .map(([[month, day], name, englishName, kind]) => ({
      date: new Date(wallTime(year, month, day, 0, timeZone)),
      key: `${year}-${pad(month + 1)}-${pad(day)}`,
      name,
      englishName,
      kind,
    }))
    .sort((x, y) => x.date.getTime() - y.date.getTime());
}
