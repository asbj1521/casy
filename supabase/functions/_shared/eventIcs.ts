/**
 * An agreed event as an iCalendar document: what Casy puts into someone's
 * primary calendar over CalDAV, and what "Add to my calendar" downloads when
 * there is no primary calendar to put it in. One builder for both, so the
 * two can't drift apart.
 *
 * The title is written in the person's own language. Events store their
 * type's English name ("Dinner"), so the Danish names are repeated here from
 * src/i18n/da.tsx (Edge Functions can't import from src/).
 */
import type { Lang } from "./i18n.ts";

/** The zone the app reads local dates in (src/lib/zone.ts APP_TIME_ZONE). */
const APP_TIME_ZONE = "Europe/Copenhagen";

/** Danish names of the event types, keyed by the English name events store. */
const DANISH_TYPE_NAMES: Record<string, string> = {
  Evening: "Aften",
  Lunch: "Frokost",
  Dinner: "Middag",
  Gaming: "Gaming",
  "Gaming session": "Gaming",
  "Night out": "I byen",
  "Weekend trip": "Weekendtur",
  Vacation: "Ferie",
};

export interface AgreedEvent {
  /** event_proposals.id: also the calendar entry's UID, so it is stable. */
  id: string;
  /** As stored: an event type's English name, or whatever was typed. */
  title: string;
  /** Where and what to know, as the suggester typed them (#84); null if not given. */
  place?: string | null;
  note?: string | null;
  groupName: string;
  /** Everyone else invited, by name. */
  others: string[];
  /** "vacation" events are whole days; everything else has times. */
  kind: string;
  /** ISO instants; for a vacation, local midnight to local midnight. */
  start: string;
  end: string;
}

/** The event's title in the reader's language. */
export function localTitle(stored: string, lang: Lang): string {
  return lang === "da"
    ? (DANISH_TYPE_NAMES[stored] ?? stored)
    : stored === "Gaming session"
      ? "Gaming"
      : stored;
}

/** "Dinner with The friends" / "Middag med Vennerne". */
export function eventSummary(event: AgreedEvent, lang: Lang): string {
  return `${localTitle(event.title, lang)} ${lang === "da" ? "med" : "with"} ${event.groupName}`;
}

function nameList(names: string[], lang: Lang): string {
  const and = lang === "da" ? "og" : "and";
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
}

/** The suggester's note, if any, then who it was agreed with. */
export function eventDescription(event: AgreedEvent, lang: Lang): string {
  const who = nameList(event.others, lang);
  const agreed =
    lang === "da"
      ? who
        ? `Aftalt i Casy med ${who}.`
        : "Aftalt i Casy."
      : who
        ? `Agreed in Casy with ${who}.`
        : "Agreed in Casy.";
  return event.note ? `${event.note}\n\n${agreed}` : agreed;
}

/** The UID Casy gives an event's calendar entry. */
export function eventUid(eventId: string): string {
  return `${eventId}@casy.app`;
}

/** The file name a calendar entry lives under: stable, so a retry finds it. */
export function eventResourceName(eventId: string): string {
  return `casy-${eventId}.ics`;
}

/** Escape a TEXT value (RFC 5545 3.3.11). */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold a content line at 75 octets, never splitting a character (RFC 5545 3.1). */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const bytes = encoder.encode(ch).length;
    // The first line holds 75 octets; continuation lines start with a space.
    const limit = parts.length === 0 ? 75 : 74;
    if (size + bytes > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** 20261002T160000Z */
function utcStamp(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** 20261002: the date in Copenhagen at that instant. */
export function localDate(iso: string): string {
  // en-CA formats as 2026-10-02.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(iso))
    .replace(/-/g, "");
}

/**
 * The whole document. Times are written in UTC, which every calendar shows in
 * its own local time, so no time zone definitions are needed; a vacation is
 * written as whole days (DTEND is the day after the last, as the standard
 * wants). No METHOD line: CalDAV refuses one in a stored event.
 */
export function buildEventIcs(event: AgreedEvent, lang: Lang, now = new Date()): string {
  const allDay = event.kind === "vacation";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Casy//Casy//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${eventUid(event.id)}`,
    `DTSTAMP:${utcStamp(now.toISOString())}`,
    allDay ? `DTSTART;VALUE=DATE:${localDate(event.start)}` : `DTSTART:${utcStamp(event.start)}`,
    allDay ? `DTEND;VALUE=DATE:${localDate(event.end)}` : `DTEND:${utcStamp(event.end)}`,
    `SUMMARY:${escapeText(eventSummary(event, lang))}`,
    `DESCRIPTION:${escapeText(eventDescription(event, lang))}`,
    ...(event.place ? [`LOCATION:${escapeText(event.place)}`] : []),
    "URL:https://casy.app/events",
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
