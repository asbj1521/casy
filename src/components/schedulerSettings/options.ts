/** The scheduler settings' values and helpers (#160), shared by the pickers and the three layouts. */
import { type ReactNode } from "react";

import type { Messages } from "@/i18n/da";
import { MAX_SPAN_DAYS, MAX_TRIP_DAYS, type SchedulerSettings } from "@/lib/scheduler";
import { formatClockMinutes } from "@/lib/format";

/** How long a meeting lasts: 30 min to 12 hours, in 30 minute steps. */
export const DURATION_VALUES = Array.from({ length: 24 }, (_, i) => (i + 1) * 30);

/** Which hour a meeting starts: any hour of the day. */
const START_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  label: `${String(h).padStart(2, "0")}:00`,
  value: h,
}));

/** The longest event name the server keeps (MAX_EVENT_TITLE_LENGTH). */
export const MAX_NAME_LENGTH = 60;

/** Stands for "any day" where a start day is picked from numbers. */
export const ANY_DAY = -1;
/** Stands for "any time" atop the start-hour dropdown, same trick as ANY_DAY. */
const ANY_TIME = -1;
/** Stands for the AI's start window (#133), listed only while there is one. */
const START_WINDOW = -2;

/** startsAt's options: the AI's window while there is one, "any time", then the hours. */
export function startHourOptions(t: Messages, settings: Pick<SchedulerSettings, "startWindow">) {
  const window = settings.startWindow
    ? [
        {
          label: t.scheduler.startWindow(
            formatClockMinutes(settings.startWindow.from),
            formatClockMinutes(settings.startWindow.to),
          ),
          value: START_WINDOW,
        },
      ]
    : [];
  return [...window, { label: t.scheduler.anyTime, value: ANY_TIME }, ...START_OPTIONS];
}

/** The start dropdown's value: the window, "any time" or the hour. */
export function startValue(settings: SchedulerSettings): number {
  if (settings.startWindow) return START_WINDOW;
  return settings.anyTime ? ANY_TIME : settings.startHour;
}

/**
 * Maps a startsAt pick back onto the settings, "any time" included. Any
 * pick by hand drops the AI's window; picking the window itself changes nothing.
 */
export function pickStartHour(
  value: number,
  onChange: (patch: Partial<SchedulerSettings>) => void,
) {
  if (value === START_WINDOW) return;
  onChange(
    value === ANY_TIME
      ? { anyTime: true, startWindow: null }
      : { startHour: value, anyTime: false, startWindow: null },
  );
}

export interface Props {
  /** The group picker, drawn by the page (it knows the groups). */
  groupSwitcher: ReactNode;
  name: string;
  onName: (name: string) => void;
  settings: SchedulerSettings;
  onChange: (patch: Partial<SchedulerSettings>) => void;
}

/** "fredag" / "Friday" for a day of week (0 = Sunday). */
export function weekdayLong(dow: number, locale: string): string {
  // 21 June 2026 is a Sunday; the time zone doesn't matter at noon UTC.
  return new Date(Date.UTC(2026, 5, 21 + dow, 12)).toLocaleDateString(locale, {
    weekday: "long",
    timeZone: "UTC",
  });
}

export function useDayValues(settings: SchedulerSettings) {
  const max = settings.startDow === null ? MAX_SPAN_DAYS : MAX_TRIP_DAYS;
  return Array.from({ length: max }, (_, i) => i + 1);
}

/**
 * The settings box's tabs, in the order a plan is made: when, who, where,
 * and how the group answers (#98).
 */
export const TABS = ["time", "people", "place", "vote"] as const;
export type Tab = (typeof TABS)[number];
