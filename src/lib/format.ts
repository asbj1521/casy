/**
 * Display helpers for turning the engine's ISO instants into readable text,
 * in the zone the schedule lives in: a meeting found for 18:00 in Copenhagen
 * reads "18:00" wherever the page happens to be opened.
 */
import { LOCALE, type Lang } from "@/i18n/locale";
import { APP_TIME_ZONE } from "@/lib/zone";

const DATE_FMT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: APP_TIME_ZONE,
};

// Times are always "16:00", in both languages. Danish Intl would write
// "16.00", but the rest of the app (the start-time picker, the grids) uses the
// colon, and one page mixing the two reads as a mistake.
const TIME_FMT: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: APP_TIME_ZONE,
};

const TO: Record<Lang, string> = { da: "til", en: "to" };

/** "Tue 23 Jun", or "tirs. 23. jun." in Danish. */
export function formatDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(LOCALE[lang], DATE_FMT);
}

/** "16:00" */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", TIME_FMT);
}

/** "Tue 23 Jun · 16:00-17:00" */
export function formatSlot(start: string, end: string, lang: Lang): string {
  return `${formatDate(start, lang)} · ${formatTime(start)}-${formatTime(end)}`;
}

/**
 * "Mon 5 Oct to Sun 11 Oct" for a whole-day span. `end` is the exclusive
 * midnight after the span, so the last day shown is the one containing the
 * moment just before it (not end minus 24 h, which is wrong across a clock
 * change).
 */
export function formatDaySpan(start: string, end: string, lang: Lang): string {
  const lastMoment = new Date(Date.parse(end) - 1).toISOString();
  return `${formatDate(start, lang)} ${TO[lang]} ${formatDate(lastMoment, lang)}`;
}

/** "Fri 25 Sep 17:00 to Sun 27 Sep 21:00" for a trip with concrete times. */
export function formatTripSpan(start: string, end: string, lang: Lang): string {
  return `${formatDate(start, lang)} ${formatTime(start)} ${TO[lang]} ${formatDate(end, lang)} ${formatTime(end)}`;
}

/** "Fredag 9. oktober" / "Friday 9 October": the scheduling page's big answer. */
export function formatLongDate(iso: string, lang: Lang): string {
  const text = new Date(iso).toLocaleDateString(LOCALE[lang], {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: APP_TIME_ZONE,
  });
  // Danish writes weekdays in lower case; this one starts a headline. English
  // Intl puts a comma after the weekday, which a headline does without.
  return (text.charAt(0).toUpperCase() + text.slice(1)).replace(",", "");
}

/**
 * formatLongSpan in its two halves, "Fredag 9. oktober til" and "søndag 11.
 * oktober", so the scheduling page's big answer can put each on its own line
 * (the break always falls after "til", however long the months are). A span
 * that starts and ends on the same day is that one day, a single line.
 */
export function formatLongSpanLines(start: string, end: string, lang: Lang): string[] {
  const last = new Date(Date.parse(end) - 1).toISOString();
  const first = formatLongDate(start, lang);
  const second = formatLongDate(last, lang);
  if (first === second) return [first];
  // Mid-sentence, a Danish weekday goes back to lower case; English keeps its capital.
  const tail = lang === "da" ? second.charAt(0).toLowerCase() + second.slice(1) : second;
  return [`${first} ${TO[lang]}`, tail];
}

/**
 * "Fredag 9. oktober til søndag 11. oktober" for a whole-day span, `end`
 * being the exclusive midnight after it (see formatDaySpan). A span that
 * starts and ends on the same day reads as that one day.
 */
export function formatLongSpan(start: string, end: string, lang: Lang): string {
  return formatLongSpanLines(start, end, lang).join(" ");
}

/** "Sep 2026": how long someone has had a Casy account, or a group has existed. */
export function formatMonthYear(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(LOCALE[lang], {
    month: "short",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  });
}
