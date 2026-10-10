/**
 * The made-up world the browser tests run in: one signed-in person (Mia),
 * her calendars, two groups, an invitation and events in every state My
 * events knows. Everything is fixed to one moment (NOW, a Wednesday) so the
 * pages, and their screenshots, are the same on every run.
 *
 * The answers are typed with the site's own types (src/api), so a change in
 * an API's shape fails the type check here instead of passing silently. These
 * tests never test the real server; #77 covers that side.
 */
import type { MyData } from "@/api/account";
import type { CalendarConnectionStatus } from "@/api/calendars";
import type { EventResponse, SuggestedEvent } from "@/api/events";
import type { Group, GroupBusy, Invitation } from "@/api/groups";
import type { OverviewBlock, OverviewCalendar } from "@/lib/calendarOverview";
import type { EventCategory } from "@/types";

/** The frozen "now": Wednesday 7 October 2026, 10:00 Danish time. */
export const NOW = "2026-10-07T08:00:00.000Z";

export const TIME_ZONE = "Europe/Copenhagen";

/* ----------------------------------------------------------------------------
 * Danish time, without the site's own helpers (the tests stay independent of
 * the code they check).
 * ------------------------------------------------------------------------- */

/** The UTC instant of a Danish wall-clock time, as ISO: cph("2026-10-13", "19:00"). */
export function cph(day: string, time: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min);
  // Guess, then correct by the zone's offset at the guess (twice covers DST edges).
  let utc = wall;
  for (let i = 0; i < 2; i++) utc = wall - offsetAt(utc);
  return new Date(utc).toISOString();
}

function offsetAt(utc: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(utc));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - utc;
}

/** The calendar day `n` days after `day` ("YYYY-MM-DD"). */
export function plusDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, as the site counts weekdays. */
function weekday(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/* ----------------------------------------------------------------------------
 * People
 * ------------------------------------------------------------------------- */

export const ME = {
  id: "p-mia",
  name: "Mia Jensen",
  email: "mia@example.com",
};

const PEOPLE = {
  jonas: { id: "p-jonas", name: "Jonas" },
  sara: { id: "p-sara", name: "Sara" },
  emil: { id: "p-emil", name: "Emil" },
  freja: { id: "p-freja", name: "Freja" },
  oliver: { id: "p-oliver", name: "Oliver" },
};

/* ----------------------------------------------------------------------------
 * Busy time: a repeating week for everyone with a calendar, from the start of
 * the search window (this month) through January.
 * ------------------------------------------------------------------------- */

interface Habit {
  /** Weekdays it happens on (0 = Sunday). */
  days: number[];
  from: string;
  to: string;
  /** Only every other week (counted from the window's start). */
  everyOtherWeek?: boolean;
  category?: EventCategory;
  /** Mia's own blocks say which of her calendars they're in. */
  calendarId?: string;
}

const HABITS: Record<string, Habit[]> = {
  [ME.id]: [
    { days: [1, 2, 3, 4, 5], from: "08:30", to: "16:00", category: "work", calendarId: "cal-work" },
    { days: [2], from: "18:00", to: "20:00", calendarId: "cal-private" },
    { days: [6], from: "11:00", to: "13:00", everyOtherWeek: true, calendarId: "cal-private" },
    { days: [0], from: "12:00", to: "15:00", everyOtherWeek: true, calendarId: "cal-family" },
    { days: [1], from: "17:00", to: "18:30", calendarId: "cal-football" },
    { days: [4], from: "19:00", to: "21:00", calendarId: "cal-google" },
  ],
  [PEOPLE.jonas.id]: [
    { days: [1, 2, 3, 4, 5], from: "07:00", to: "15:00", category: "work" },
    { days: [4], from: "19:00", to: "22:00" },
  ],
  [PEOPLE.sara.id]: [
    { days: [1, 2, 3, 4, 5], from: "09:00", to: "14:00", category: "school" },
    { days: [5], from: "17:00", to: "23:00", everyOtherWeek: true },
  ],
  [PEOPLE.freja.id]: [
    { days: [1, 2, 3, 4], from: "08:00", to: "17:00", category: "work" },
    { days: [3], from: "18:00", to: "21:00" },
  ],
  [PEOPLE.oliver.id]: [
    { days: [1, 2, 3, 4, 5], from: "10:00", to: "18:00", category: "school" },
    { days: [6, 0], from: "09:00", to: "12:00", everyOtherWeek: true },
  ],
};

const BUSY_FROM = "2026-10-01";
const BUSY_TO = "2027-02-01";

interface Busy {
  start: string;
  end: string;
  category?: EventCategory;
  calendarId?: string;
}

function busyOf(profileId: string): Busy[] {
  const blocks: Busy[] = [];
  for (let day = BUSY_FROM, i = 0; day < BUSY_TO; day = plusDays(day, 1), i++) {
    const week = Math.floor(i / 7);
    for (const habit of HABITS[profileId] ?? []) {
      if (!habit.days.includes(weekday(day))) continue;
      if (habit.everyOtherWeek && week % 2 === 1) continue;
      blocks.push({
        start: cph(day, habit.from),
        end: cph(day, habit.to),
        category: habit.category,
        calendarId: habit.calendarId,
      });
    }
  }
  return blocks;
}

/* ----------------------------------------------------------------------------
 * Mia's calendars
 * ------------------------------------------------------------------------- */

function connections(): CalendarConnectionStatus[] {
  const synced = "2026-10-07T07:40:00.000Z"; // 20 minutes before NOW
  const count = (ids: string[]) =>
    busyOf(ME.id).filter((b) => b.calendarId && ids.includes(b.calendarId)).length;
  return [
    {
      id: "conn-apple",
      provider: "apple",
      status: "connected",
      account_label: "mia@icloud.com",
      error_message: null,
      created_at: "2026-09-01T10:00:00.000Z",
      last_synced_at: synced,
      last_sync_attempt_at: synced,
      sync_error: null,
      needs_reconnect: false,
      calendar_sources: [
        {
          id: "cal-work",
          display_name: "Arbejde",
          custom_name: null,
          purpose: "work",
          priority: "normal",
          writable: true,
          // Every category set by hand (Familie's left blank on purpose), so
          // nothing here is sorted by AI unless a test asks for it.
          purpose_source: "user",
          external_id: null,
        },
        {
          id: "cal-private",
          display_name: "Privat",
          custom_name: null,
          purpose: "personal",
          priority: "normal",
          writable: true,
          purpose_source: "user",
          external_id: null,
        },
        {
          id: "cal-family",
          display_name: "Familie",
          custom_name: null,
          purpose: null,
          priority: "normal",
          writable: false,
          purpose_source: "user",
          external_id: null,
        },
      ],
      busyCount: count(["cal-work", "cal-private", "cal-family"]),
    },
    {
      id: "conn-google",
      provider: "google",
      status: "connected",
      account_label: "mia@example.com",
      error_message: null,
      created_at: "2026-09-05T10:00:00.000Z",
      last_synced_at: synced,
      last_sync_attempt_at: synced,
      sync_error: null,
      needs_reconnect: false,
      calendar_sources: [
        {
          id: "cal-google",
          display_name: "mia@example.com",
          custom_name: "Kor",
          purpose: "personal",
          priority: "normal",
          writable: false,
          purpose_source: "user",
          external_id: null,
        },
      ],
      busyCount: count(["cal-google"]),
    },
    {
      id: "conn-ics",
      provider: "ics",
      status: "connected",
      account_label: "Fodbold",
      error_message: null,
      created_at: "2026-09-10T10:00:00.000Z",
      last_synced_at: synced,
      last_sync_attempt_at: synced,
      sync_error: null,
      needs_reconnect: false,
      calendar_sources: [
        {
          id: "cal-football",
          display_name: "Fodbold",
          custom_name: null,
          purpose: "other",
          priority: "skip",
          writable: false,
          purpose_source: "user",
          external_id: null,
        },
      ],
      busyCount: count(["cal-football"]),
    },
  ];
}

/** My calendar's view of a connection list. */
function overviewCalendars(conns: CalendarConnectionStatus[]): OverviewCalendar[] {
  return conns.flatMap((c) =>
    c.calendar_sources.map((s) => ({
      id: s.id,
      name: s.custom_name ?? s.display_name ?? "",
      originalName: s.display_name,
      renamed: s.custom_name !== null,
      writable: s.writable,
      purpose: s.purpose,
      purposeGuessed: s.purpose_source === "ai" && s.purpose !== null,
      priority: s.priority,
      included: true,
      total: busyOf(ME.id).filter((b) => b.calendarId === s.id).length,
      provider: c.provider,
      account: c.account_label,
      connectionId: c.id,
    })),
  );
}

/* ----------------------------------------------------------------------------
 * Groups
 * ------------------------------------------------------------------------- */

function member(p: { id: string; name: string }, joinedAt: string) {
  return { profileId: p.id, name: p.name, isYou: p.id === ME.id, joinedAt };
}

function groups(): Group[] {
  return [
    {
      id: "g-friday",
      name: "Fredagsbar",
      createdAt: "2026-09-01T12:00:00.000Z",
      createdBy: ME.id,
      members: [
        member(ME, "2026-09-01T12:00:00.000Z"),
        member(PEOPLE.jonas, "2026-09-02T12:00:00.000Z"),
        member(PEOPLE.sara, "2026-09-02T13:00:00.000Z"),
        member(PEOPLE.emil, "2026-09-03T12:00:00.000Z"),
      ],
      invited: [],
    },
    {
      id: "g-running",
      name: "Løbeklubben",
      createdAt: "2026-09-10T12:00:00.000Z",
      createdBy: PEOPLE.freja.id,
      members: [
        member(PEOPLE.freja, "2026-09-10T12:00:00.000Z"),
        member(ME, "2026-09-11T12:00:00.000Z"),
        member(PEOPLE.oliver, "2026-09-12T12:00:00.000Z"),
      ],
      invited: [],
    },
  ];
}

const invitations = (): Invitation[] => [
  {
    groupId: "g-badminton",
    groupName: "Badminton",
    memberCount: 5,
    invitedBy: "Sara",
    createdAt: "2026-10-06T18:00:00.000Z",
  },
];

/** Who has a calendar: everyone but Emil, who checks dates by hand (#82). */
const CONNECTED = new Set([
  ME.id,
  PEOPLE.jonas.id,
  PEOPLE.sara.id,
  PEOPLE.freja.id,
  PEOPLE.oliver.id,
]);

/* ----------------------------------------------------------------------------
 * Events: one in each of My events' sections, plus a cancelled one that
 * shows nowhere.
 * ------------------------------------------------------------------------- */

type Person = { id: string; name: string };

function invitee(p: Person, response: EventResponse | null) {
  return { profileId: p.id, name: p.name, isYou: p.id === ME.id, response };
}

function events(): SuggestedEvent[] {
  const evening = { kind: "single", durationMinutes: 180, startHour: 19 } as const;
  const friday = [ME, PEOPLE.jonas, PEOPLE.sara, PEOPLE.emil];
  const running = [ME, PEOPLE.freja, PEOPLE.oliver];
  const base = {
    declinedDates: [],
    candidates: [],
    answerBy: null,
    myCalendar: null,
    place: null,
    note: null,
  };
  return [
    // A vote waiting for Mia's answers (toSwipe).
    {
      ...base,
      id: "ev-boardgames",
      group: { id: "g-friday", name: "Fredagsbar" },
      title: "Brætspilsaften",
      place: "Hos Jonas, Nørrebrogade 12",
      note: "Tag dit yndlingsspil med",
      settings: evening,
      status: "pending",
      mode: "vote",
      answerBy: "2026-10-09T08:00:00.000Z",
      createdBy: { id: PEOPLE.jonas.id, name: "Jonas", isYou: false },
      createdAt: "2026-10-06T08:00:00.000Z",
      updatedAt: "2026-10-06T20:00:00.000Z",
      currentDate: null,
      invitees: friday.map((p) => invitee(p, null)),
      candidates: [
        {
          id: "d-bg-1",
          start: cph("2026-10-14", "19:00"),
          end: cph("2026-10-14", "22:00"),
          answers: { [PEOPLE.jonas.id]: "accepted", [PEOPLE.sara.id]: "accepted" },
        },
        {
          id: "d-bg-2",
          start: cph("2026-10-17", "19:00"),
          end: cph("2026-10-17", "22:00"),
          answers: { [PEOPLE.jonas.id]: "accepted", [PEOPLE.sara.id]: "maybe" },
        },
        {
          id: "d-bg-3",
          start: cph("2026-10-21", "19:00"),
          end: cph("2026-10-21", "22:00"),
          answers: { [PEOPLE.jonas.id]: "declined" },
        },
      ],
    },
    // A vote Mia suggested and answered, waiting for the others (voting).
    {
      ...base,
      id: "ev-cinema",
      group: { id: "g-running", name: "Løbeklubben" },
      title: "Biograf",
      settings: { kind: "single", durationMinutes: 150, startHour: 20 },
      status: "pending",
      mode: "vote",
      answerBy: "2026-10-10T08:00:00.000Z",
      createdBy: { id: ME.id, name: ME.name, isYou: true },
      createdAt: "2026-10-07T07:00:00.000Z",
      updatedAt: "2026-10-07T07:30:00.000Z",
      currentDate: null,
      invitees: running.map((p) => invitee(p, null)),
      candidates: [
        {
          id: "d-cin-1",
          start: cph("2026-10-16", "20:00"),
          end: cph("2026-10-16", "22:30"),
          answers: { [ME.id]: "accepted", [PEOPLE.freja.id]: "accepted" },
        },
        {
          id: "d-cin-2",
          start: cph("2026-10-23", "20:00"),
          end: cph("2026-10-23", "22:30"),
          answers: { [ME.id]: "maybe" },
        },
      ],
    },
    // One date at a time, from before votes: waiting for Mia (needsAnswer).
    {
      ...base,
      id: "ev-dinner",
      group: { id: "g-friday", name: "Fredagsbar" },
      title: "Middag hos Sara",
      settings: { kind: "single", durationMinutes: 180, startHour: 18 },
      status: "pending",
      mode: "single",
      createdBy: { id: PEOPLE.sara.id, name: "Sara", isYou: false },
      createdAt: "2026-10-01T08:00:00.000Z",
      updatedAt: "2026-10-05T08:00:00.000Z",
      currentDate: {
        id: "d-din-2",
        start: cph("2026-10-18", "18:00"),
        end: cph("2026-10-18", "21:00"),
      },
      invitees: [
        invitee(ME, null),
        invitee(PEOPLE.emil, null),
        invitee(PEOPLE.jonas, "accepted"),
        invitee(PEOPLE.sara, "accepted"),
      ],
      declinedDates: [
        { start: cph("2026-10-11", "18:00"), end: cph("2026-10-11", "21:00"), declinedBy: "Jonas" },
      ],
    },
    // Mia said yes; Oliver hasn't answered (waiting).
    {
      ...base,
      id: "ev-run",
      group: { id: "g-running", name: "Løbeklubben" },
      title: "Løbetur",
      settings: { kind: "single", durationMinutes: 90, startHour: 9 },
      status: "pending",
      mode: "single",
      createdBy: { id: PEOPLE.freja.id, name: "Freja", isYou: false },
      createdAt: "2026-10-04T08:00:00.000Z",
      updatedAt: "2026-10-05T08:00:00.000Z",
      currentDate: {
        id: "d-run-1",
        start: cph("2026-10-11", "09:00"),
        end: cph("2026-10-11", "10:30"),
      },
      invitees: [
        invitee(ME, "accepted"),
        invitee(PEOPLE.freja, "accepted"),
        invitee(PEOPLE.oliver, null),
      ],
    },
    // Agreed and in Mia's calendar (scheduled).
    {
      ...base,
      id: "ev-party",
      group: { id: "g-friday", name: "Fredagsbar" },
      title: "Julefrokost",
      place: "Mikkeller Bar",
      settings: { kind: "single", durationMinutes: 300, startHour: 18 },
      status: "scheduled",
      mode: "single",
      createdBy: { id: ME.id, name: ME.name, isYou: true },
      createdAt: "2026-09-20T08:00:00.000Z",
      updatedAt: "2026-09-25T08:00:00.000Z",
      currentDate: {
        id: "d-party-1",
        start: cph("2026-11-28", "18:00"),
        end: cph("2026-11-28", "23:00"),
      },
      invitees: friday.map((p) => invitee(p, "accepted")),
      myCalendar: { state: "added" },
    },
    // Past and closed: one that happened, one that found no date.
    {
      ...base,
      id: "ev-birthday",
      group: { id: "g-friday", name: "Fredagsbar" },
      title: "Fødselsdag",
      settings: evening,
      status: "scheduled",
      mode: "single",
      createdBy: { id: PEOPLE.jonas.id, name: "Jonas", isYou: false },
      createdAt: "2026-09-10T08:00:00.000Z",
      updatedAt: "2026-09-12T08:00:00.000Z",
      currentDate: {
        id: "d-bday-1",
        start: cph("2026-09-26", "19:00"),
        end: cph("2026-09-26", "22:00"),
      },
      invitees: friday.map((p) => invitee(p, "accepted")),
    },
    {
      ...base,
      id: "ev-trip",
      group: { id: "g-running", name: "Løbeklubben" },
      title: "Hyttetur",
      settings: { kind: "vacation", days: 3 },
      status: "no_date",
      mode: "single",
      createdBy: { id: PEOPLE.oliver.id, name: "Oliver", isYou: false },
      createdAt: "2026-09-15T08:00:00.000Z",
      // Within the week a phone keeps past events on its list (#103).
      updatedAt: "2026-10-04T08:00:00.000Z",
      currentDate: null,
      invitees: running.map((p) => invitee(p, null)),
    },
    {
      ...base,
      id: "ev-cancelled",
      group: { id: "g-friday", name: "Fredagsbar" },
      title: "Aflyst",
      settings: evening,
      status: "cancelled",
      mode: "single",
      createdBy: { id: ME.id, name: ME.name, isYou: true },
      createdAt: "2026-09-15T08:00:00.000Z",
      updatedAt: "2026-09-16T08:00:00.000Z",
      currentDate: null,
      invitees: friday.map((p) => invitee(p, null)),
    },
  ];
}

/* ----------------------------------------------------------------------------
 * The world as a whole, in the shapes the functions answer with.
 * ------------------------------------------------------------------------- */

export interface WorldOptions {
  /** Mia's linked accounts: all three, or none yet. */
  calendars: "connected" | "none";
  /** Mia's groups (and the events in them), or none yet: the scheduler shows examples. */
  groups: "some" | "none";
}

export const DEFAULT_WORLD: WorldOptions = { calendars: "connected", groups: "some" };

export interface World {
  name: string;
  connections: CalendarConnectionStatus[];
  primary: { calendarId: string; autoAdd: boolean } | null;
  groups: Group[];
  invitations: Invitation[];
  events: SuggestedEvent[];
  /** Bumped on every change, so the live-update pulse moves like the real one. */
  version: number;
}

export function makeWorld(options: WorldOptions): World {
  const connected = options.calendars === "connected";
  const withGroups = options.groups === "some";
  return {
    name: ME.name,
    connections: connected ? connections() : [],
    primary: connected ? { calendarId: "cal-private", autoAdd: false } : null,
    groups: withGroups ? groups() : [],
    invitations: invitations(),
    events: withGroups ? events() : [],
    version: 1,
  };
}

/** Mia's own blocks between two instants, for My calendar. */
export function myOverview(world: World, from: string, to: string) {
  const calendarIds = new Set(
    world.connections.flatMap((c) => c.calendar_sources.map((s) => s.id)),
  );
  const blocks: OverviewBlock[] = busyOf(ME.id)
    .filter((b) => b.calendarId && calendarIds.has(b.calendarId))
    .filter((b) => b.end > from && b.start < to)
    .map((b) => ({ calendarId: b.calendarId as string, start: b.start, end: b.end }));
  return { calendars: overviewCalendars(world.connections), blocks, truncated: false };
}

/** Everyone's busy time in one group, as the groups function's `busy` answers it. */
export function groupBusy(world: World, groupId: string, from: string, to: string): GroupBusy {
  const group = world.groups.find((g) => g.id === groupId);
  const busy: GroupBusy["busy"] = {};
  const connected: GroupBusy["connected"] = {};
  for (const m of group?.members ?? []) {
    const has = m.profileId === ME.id ? world.connections.length > 0 : CONNECTED.has(m.profileId);
    connected[m.profileId] = has;
    busy[m.profileId] = has
      ? busyOf(m.profileId)
          .filter((b) => b.end > from && b.start < to)
          .map(({ start, end, category }) => ({ start, end, category }))
      : [];
  }
  return { busy, connected, truncated: false };
}

/** Everything Casy holds about Mia, for Your data. */
export function myData(world: World): MyData {
  const mine = busyOf(ME.id);
  return {
    account: {
      email: ME.email,
      name: world.name,
      nameIsCustom: false,
      signIn: ["email"],
      language: "da",
      createdAt: "2026-09-01T10:00:00.000Z",
    },
    calendars: world.connections.map((c) => ({
      provider: c.provider,
      label: c.account_label,
      status: c.status,
      connectedAt: c.created_at,
      lastSyncedAt: c.last_synced_at,
      credential: c.provider === "apple" ? "password" : c.provider === "ics" ? "link" : "oauth",
      calendars: c.calendar_sources.map((s) => ({
        name: s.display_name,
        customName: s.custom_name,
        purpose: s.purpose,
        purposeGuessed: s.purpose_source === "ai" && s.purpose !== null,
        priority: s.priority,
        included: true,
        busyCount: mine.filter((b) => b.calendarId === s.id).length,
      })),
    })),
    primary: world.primary
      ? { calendar: "Privat", autoAdd: world.primary.autoAdd, lang: "da" }
      : null,
    busy: {
      count: mine.length,
      first: mine[0]?.start ?? null,
      last: mine.at(-1)?.end ?? null,
      next: mine.filter((b) => b.start > NOW).slice(0, 3),
    },
    groups: world.groups.map((g) => ({
      name: g.name,
      members: g.members.length,
      createdByYou: g.createdBy === ME.id,
      joinedAt: g.members.find((m) => m.isYou)?.joinedAt ?? g.createdAt,
    })),
    inviteLinks: { made: 2, active: 1 },
    invitations: { pending: world.invitations.length, declined: 0, sent: 3 },
    emailLookups: 0,
    events: { invitedTo: world.events.length, suggested: 2, answers: 9, declined: 1 },
    calendarEntries: { added: 1, deletedByYou: 0 },
  };
}
