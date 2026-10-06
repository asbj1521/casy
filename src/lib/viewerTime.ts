/**
 * Danish time, and the clock of the person looking.
 *
 * Every date and time Casy shows is Danish time (APP_TIME_ZONE): the scheduler
 * searches in it, and a whole group has to agree on what "18:00" means.
 * Someone whose browser keeps another clock (studying abroad, travelling, a
 * friend in another country) is told so once per page (DanishTimeNote), and
 * sees their own time beside an event's (YourTime): "12:00-14:00 your time".
 * In Denmark, or anywhere with the same clock, none of it shows.
 */
import type { Lang } from "@/i18n/locale";
import type { EventSettings } from "@/lib/eventSearch";
import { formatDate, formatTime } from "@/lib/format";
import { APP_TIME_ZONE, browserTimeZone, sameClock } from "@/lib/zone";

/** The browser's zone, read once: it doesn't change while a page is open. */
export const VIEWER_TIME_ZONE = browserTimeZone();

/** True when the person's clock is not Danish time, so the page should say so. */
export const VIEWER_ELSEWHERE = !sameClock(
  VIEWER_TIME_ZONE,
  APP_TIME_ZONE,
  new Date().getUTCFullYear(),
);

/**
 * An event's date on the viewer's own clock, or null when there is nothing
 * to add: the same clock as Danish time, or a holiday, which is whole Danish
 * days and has no times. A meeting is just its times, with the viewer's date
 * in front when that is another day ("Sat 10 Oct 01:00-03:00" in Tokyo for
 * Friday 18:00); a trip is both ends with their dates.
 */
export function yourTime(
  kind: EventSettings["kind"],
  date: { start: string; end: string },
  lang: Lang,
  viewerZone: string = VIEWER_TIME_ZONE,
): string | null {
  if (kind === "vacation") return null;
  if (sameClock(viewerZone, APP_TIME_ZONE, new Date(date.start).getUTCFullYear())) return null;

  const time = (iso: string) => formatTime(iso, viewerZone);
  const day = (iso: string) => formatDate(iso, lang, viewerZone);
  if (kind === "trip") {
    const to = lang === "da" ? "til" : "to";
    return `${day(date.start)} ${time(date.start)} ${to} ${day(date.end)} ${time(date.end)}`;
  }
  const times = `${time(date.start)}-${time(date.end)}`;
  // Another calendar day where the viewer is: compare the dates as written.
  const otherDay = formatDate(date.start, "en") !== formatDate(date.start, "en", viewerZone);
  return otherDay ? `${day(date.start)} ${times}` : times;
}
