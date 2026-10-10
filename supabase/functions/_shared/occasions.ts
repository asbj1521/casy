/**
 * Danish occasions (#123): one hand-checked list of what common plans
 * usually mean, shared by every AI skill so they read "julefrokost",
 * "fredagsbar" or "hygge" the same way. Planlæg med AI (planAi.ts) takes the
 * typical time, length, days and season; the event profile (profileAi.ts)
 * the effects, strain and recovery; the labels (labelAi.ts) the kind. Each
 * prompt carries the same block (occasionsBlock) and says how to use it.
 *
 * This is common sense about occasions, never about people: what a person
 * says always wins over a typical value. An entry is used only once checked
 * (status): "reviewed" by a person, or "agreed" (two independent drafts
 * agreed, or the value was already in a shipped prompt). "draft" rows wait
 * here for review and never reach a prompt.
 *
 * Every entry also becomes eval cases (supabase/evals/run.ts), so a prompt
 * change can't quietly break an occasion. The repo is public: names of real
 * people, places or events never go in here.
 */
import type { Confidence, Effect, Strain } from "./eventVocabulary.ts";
import type { Kind } from "./labelAi.ts";

export type OccasionStatus = "reviewed" | "agreed" | "draft";

export interface Occasion {
  /** Stable key, lowercase ascii: "julefrokost", "morning-run". */
  id: string;
  /** What people call it in Danish, first the usual name: spellings, slang, short forms. */
  da: string[];
  /** The same in English, as Danes and others would write it. */
  en: string[];
  /** How the scheduler plans it. */
  plan: "meeting" | "trip" | "holiday";
  /** Meetings: the usual start hour (Danish time), or "any" when the time of day doesn't matter. */
  start?: number | "any";
  /** Meetings: the usual length in minutes, a multiple of 30. */
  minutes?: number;
  /** Trips and holidays: the usual number of days. */
  days?: number;
  /** Trips: the weekday it usually starts, 0 = Sunday ... 6 = Saturday. */
  startWeekday?: number;
  /** Only when the day is part of what it is (a fredagsbar is a Friday), 0 = Sunday. */
  onWeekdays?: number[];
  /** Only when the season is part of what it is (a julefrokost is November or December), 1 to 12. */
  inMonths?: number[];
  /** What going usually causes (the shared vocabulary). */
  effects: Effect[];
  /** Usually goes on past its planned end. */
  runsLate: boolean;
  strain: Strain;
  recoveryDays: number;
  outdoors: boolean;
  /** Needs daylight to happen as planned. */
  daylight: boolean;
  /** The label kind when it is in someone's own calendar. */
  label: Kind;
  /**
   * Says too little to plan from ("hygge", "ses"): Casy should ask what kind
   * of plan it is, and describe it with low confidence and no effects.
   */
  vague: boolean;
  /** One short English line on what is easy to get wrong, when something is. */
  note?: string;
  status: OccasionStatus;
}

/** How sure a skill may be when the text is just this occasion's name. */
export const occasionConfidence = (o: Occasion): Confidence => (o.vague ? "low" : "high");

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function length(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : h === 0 ? `${m} min` : `${h} h ${m} min`;
}

/**
 * One occasion as a prompt line: names, then what it usually is.
 *   julefrokost (julefrokost, julefrokosten | Christmas party): meeting from 17
 *   for 7 h, Nov-Dec; alcohol, lateNight, runs late; strain heavy, recovery 1;
 *   label party. A Christmas party despite the name, never a lunch at 12.
 */
export function occasionLine(o: Occasion): string {
  const names = `${o.da.join(", ")}${o.en.length > 0 ? ` | ${o.en.join(", ")}` : ""}`;
  if (o.vague) {
    return `- ${o.id} (${names}): vague, says too little to plan from; label ${o.label}.${o.note ? ` ${o.note}` : ""}`;
  }
  const when: string[] = [];
  if (o.plan === "meeting") {
    const from =
      o.start === undefined ? "" : o.start === "any" ? " at any time" : ` from ${o.start}`;
    when.push(`meeting${from}${o.minutes ? ` for ${length(o.minutes)}` : ""}`);
  } else {
    const start = o.startWeekday === undefined ? "" : ` from ${WEEKDAY[o.startWeekday]}`;
    when.push(`${o.plan}${o.days ? ` of ${o.days} days` : ""}${start}`);
  }
  if (o.onWeekdays?.length) when.push(`on ${o.onWeekdays.map((d) => WEEKDAY[d]).join("/")}`);
  if (o.inMonths?.length) when.push(monthsText(o.inMonths));
  const causes = [...o.effects, ...(o.runsLate ? ["runs late"] : [])];
  const body = [
    when.join(", "),
    causes.length > 0 ? causes.join(", ") : "nothing in particular",
    `strain ${o.strain}${o.recoveryDays > 0 ? `, recovery ${o.recoveryDays}` : ""}${o.outdoors ? ", outdoors" : ""}${o.daylight ? ", daylight" : ""}`,
    `label ${o.label}`,
  ];
  return `- ${o.id} (${names}): ${body.join("; ")}.${o.note ? ` ${o.note}` : ""}`;
}

/** "Nov-Dec", "Jun", or "Mar/Apr" for months that aren't a run. */
function monthsText(months: number[]): string {
  const sorted = [...months].sort((a, b) => a - b);
  const run = sorted.every((m, i) => i === 0 || m === sorted[i - 1] + 1);
  if (sorted.length === 1) return MONTH[sorted[0] - 1];
  return run
    ? `${MONTH[sorted[0] - 1]}-${MONTH[sorted[sorted.length - 1] - 1]}`
    : sorted.map((m) => MONTH[m - 1]).join("/");
}

/** The checked occasions, the only ones any prompt sees. */
export const usableOccasions = (): Occasion[] => OCCASIONS.filter((o) => o.status !== "draft");

/**
 * The glossary as a block of a system prompt. Each skill puts its own
 * sentence before it saying which parts to use.
 */
export function occasionsBlock(): string {
  return [
    "<occasions>",
    "Common occasions and what they usually are. Names may come inflected, misspelt or as near variants (julefrokosten, julefrokst, firmajulefrokost); read them as the occasion. These are typical values only: whatever the person says wins. Hours are Danish time; weekdays and months are listed only when they are part of what the occasion is.",
    ...usableOccasions().map(occasionLine),
    "</occasions>",
  ].join("\n");
}

/** Every name of an occasion, lowercased, for the evals and the test that names are unique. */
export const occasionNames = (o: Occasion): string[] =>
  [...o.da, ...o.en].map((n) => n.toLowerCase());

// ---------------------------------------------------------------------------
// The list. Keep it sorted by kind of occasion, then by name.

export const OCCASIONS: Occasion[] = [
  // Food and drink.
  {
    id: "coffee",
    da: ["kaffe", "en kop kaffe", "kaffeaftale"],
    en: ["coffee", "grab a coffee"],
    plan: "meeting",
    start: "any",
    minutes: 60,
    effects: [],
    runsLate: false,
    strain: "light",
    recoveryDays: 0,
    outdoors: false,
    daylight: false,
    label: "social",
    vague: false,
    status: "agreed",
  },
  {
    id: "lunch",
    da: ["frokost"],
    en: ["lunch"],
    plan: "meeting",
    start: 12,
    minutes: 90,
    effects: [],
    runsLate: false,
    strain: "light",
    recoveryDays: 0,
    outdoors: false,
    daylight: false,
    label: "social",
    vague: false,
    note: "A frokost with a season in its name (julefrokost, påskefrokost) is a party, not this.",
    status: "agreed",
  },
  {
    id: "dinner",
    da: ["middag", "aftensmad", "spise sammen"],
    en: ["dinner"],
    plan: "meeting",
    start: 18,
    minutes: 180,
    effects: [],
    runsLate: false,
    strain: "moderate",
    recoveryDays: 0,
    outdoors: false,
    daylight: false,
    label: "dinner",
    vague: false,
    status: "agreed",
  },
  {
    id: "wine-tasting",
    da: ["vinsmagning"],
    en: ["wine tasting"],
    plan: "meeting",
    start: 19,
    minutes: 180,
    effects: ["alcohol"],
    runsLate: false,
    strain: "moderate",
    recoveryDays: 0,
    outdoors: false,
    daylight: false,
    label: "social",
    vague: false,
    status: "agreed",
  },
  // Evenings in and out.
  {
    id: "film-night",
    da: ["filmaften", "film"],
    en: ["movie night", "film night"],
    plan: "meeting",
    start: 19,
    minutes: 150,
    effects: [],
    runsLate: false,
    strain: "light",
    recoveryDays: 0,
    outdoors: false,
    daylight: false,
    label: "social",
    vague: false,
    status: "agreed",
  },
  {
    id: "game-night",
    da: ["spilleaften", "brætspilsaften"],
    en: ["game night", "board game night"],
    plan: "meeting",
    start: 19,
    minutes: 180,
    effects: [],
    runsLate: false,
    strain: "light",
    recoveryDays: 0,
    outdoors: false,
    daylight: false,
    label: "social",
    vague: false,
    status: "agreed",
  },
  {
    id: "party",
    da: ["fest", "party", "gilde"],
    en: ["party"],
    plan: "meeting",
    start: 19,
    minutes: 300,
    effects: ["alcohol", "lateNight"],
    runsLate: true,
    strain: "heavy",
    recoveryDays: 1,
    outdoors: false,
    daylight: false,
    label: "party",
    vague: false,
    status: "agreed",
  },
  {
    id: "julefrokost",
    da: ["julefrokost", "julefrokosten", "firmajulefrokost"],
    en: ["Christmas party", "Christmas lunch"],
    plan: "meeting",
    start: 17,
    minutes: 420,
    inMonths: [11, 12],
    effects: ["alcohol", "lateNight"],
    runsLate: true,
    strain: "heavy",
    recoveryDays: 1,
    outdoors: false,
    daylight: false,
    label: "party",
    vague: false,
    note: "A Christmas party despite the name (frokost means lunch): afternoon or evening into the night, never a lunch at 12.",
    status: "agreed",
  },
  {
    id: "fredagsbar",
    da: ["fredagsbar", "fredagsøl"],
    en: ["Friday bar", "Friday drinks"],
    plan: "meeting",
    start: 16,
    minutes: 300,
    onWeekdays: [5],
    effects: ["alcohol"],
    runsLate: true,
    strain: "moderate",
    recoveryDays: 0,
    outdoors: false,
    daylight: false,
    label: "party",
    vague: false,
    status: "agreed",
  },
  {
    id: "night-out",
    da: ["bytur", "i byen", "byen"],
    en: ["night out", "going out"],
    plan: "meeting",
    start: 21,
    minutes: 300,
    effects: ["alcohol", "lateNight"],
    runsLate: true,
    strain: "heavy",
    recoveryDays: 1,
    outdoors: false,
    daylight: false,
    label: "party",
    vague: false,
    note: "After something else (middag og så i byen) it makes that evening one meeting running past midnight, at least until 2.",
    status: "agreed",
  },
  // Sport and outdoors.
  {
    id: "padel",
    da: ["padel", "padeltennis"],
    en: ["padel"],
    plan: "meeting",
    start: "any",
    minutes: 90,
    effects: ["exercise"],
    runsLate: false,
    strain: "moderate",
    recoveryDays: 0,
    outdoors: false,
    daylight: false,
    label: "sport",
    vague: false,
    status: "agreed",
  },
  {
    id: "hike",
    da: ["vandretur", "hike"],
    en: ["hike", "hiking"],
    plan: "meeting",
    start: 10,
    minutes: 300,
    effects: ["exercise"],
    runsLate: false,
    strain: "heavy",
    recoveryDays: 0,
    outdoors: true,
    daylight: true,
    label: "sport",
    vague: false,
    status: "agreed",
  },
  {
    id: "football-watch",
    da: ["fodboldkamp", "se fodbold", "til kamp"],
    en: ["football match", "watch the match"],
    plan: "meeting",
    start: "any",
    minutes: 150,
    effects: [],
    runsLate: false,
    strain: "moderate",
    recoveryDays: 0,
    outdoors: false,
    daylight: false,
    label: "show",
    vague: false,
    note: "A professional club's match at a stadium is watched, not played: no exercise.",
    status: "agreed",
  },
  // Away.
  {
    id: "cabin-weekend",
    da: ["hyttetur", "weekendtur", "sommerhustur"],
    en: ["weekend away", "cabin weekend"],
    plan: "trip",
    days: 3,
    startWeekday: 5,
    effects: ["travel"],
    runsLate: false,
    strain: "moderate",
    recoveryDays: 0,
    outdoors: false,
    daylight: false,
    label: "vacation",
    vague: false,
    status: "agreed",
  },
  // Too vague to plan from.
  {
    id: "hygge",
    da: ["hygge", "hyggeaften"],
    en: ["hang out"],
    plan: "meeting",
    effects: [],
    runsLate: false,
    strain: "light",
    recoveryDays: 0,
    outdoors: false,
    daylight: false,
    label: "social",
    vague: true,
    note: "Could be a coffee, an evening or a weekend: ask.",
    status: "agreed",
  },
  {
    id: "see-each-other",
    da: ["ses", "vi skal ses", "mødes"],
    en: ["meet up", "catch up"],
    plan: "meeting",
    effects: [],
    runsLate: false,
    strain: "light",
    recoveryDays: 0,
    outdoors: false,
    daylight: false,
    label: "unclear",
    vague: true,
    note: "Says only that they meet: ask what kind of plan.",
    status: "agreed",
  },
];
