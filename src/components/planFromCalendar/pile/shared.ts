/** What the pile screen's parts share (#160, split out of PileScreen.tsx). */

import type { EventToProfile } from "@/api/eventProfile";
import { type RankedFacts } from "@/lib/paperPile";
import type { FoundDate } from "@/lib/scheduler";

const PHASES = ["landing", "pressed", "revealed", "lifted", "ranking", "done"] as const;
export type Phase = (typeof PHASES)[number];
export const atLeast = (phase: Phase, than: Phase) => PHASES.indexOf(phase) >= PHASES.indexOf(than);

/** The most dates in the list: the chosen ones, and others that work, up to this. */
export const LIST_MAX = 8;

/**
 * Lifting the dates into the list: a moment before the calendar starts to
 * scroll, its speed between dates (kept within a range, so a long way is
 * brisk and a short one still reads), and the stop as each date turns into
 * its row.
 */
export const SCROLL_START_MS = 250;
export const SCROLL_PX_PER_S = 900;
export const SCROLL_MIN_S = 0.25;
export const SCROLL_MAX_S = 1.1;
export const ARRIVAL_PAUSE_MS = 320;
/** How far the calendar scrolls between two light ticks under the thumb. */
export const SCROLL_TICK_PX = 70;

/** A colour per friend, Apple Calendar's own, in the group's order. */
export const FRIEND_COLORS = [
  "0, 122, 255",
  "52, 199, 89",
  "175, 82, 222",
  "255, 149, 0",
  "255, 45, 85",
  "90, 200, 250",
  "162, 132, 94",
  "88, 86, 214",
];

/** How far the press pushes a row down in the middle of the month, in pixels. */
export const PRESS_PX = 5;

/** Where your month sits on screen: the layers land exactly on it. */
export interface Frame {
  /** Which month was measured (its local midnight). */
  month: number;
  top: number;
  left: number;
  width: number;
  height: number;
  /** Where the page's big month name is, which the pile reaches up to and draws over. */
  title: { top: number; left: number } | null;
}

/** How far the pile's top edge sits above the month name. */
export const TITLE_EDGE_PX = 6;

/**
 * How much taller than the month the pile is: it reaches up to take in My
 * calendar's big month name, so the pile shows one month name, in the page's
 * own place, rather than a second, small one over the 1st (#162). Nothing
 * without a name measured.
 */
export function titleBand(frame: Frame): number {
  return frame.title ? frame.top - frame.title.top + TITLE_EDGE_PX : 0;
}

/** One date in the list, with what Casy checked about it. */
export interface CheckedDate {
  date: FoundDate;
  /** Its local day, for the green circle it flies up out of. */
  day: number;
  chosen: boolean;
  /** What Casy checked and found, in order; `notable` when it counts against the date. */
  checks: { found: string; notable: boolean }[];
  /** What ranks it (rankOrder). */
  facts: RankedFacts;
  /**
   * The first of your own important events it runs into (#114), in words:
   * shown on the row as it is checked. App only, admins and AI testers.
   */
  yours: string | null;
}

/** No event to profile yet: the query stays off. */
export const NO_INPUT = {} as EventToProfile;

/** Where a row flies from: its green circle, as an offset and scale from where it ends up. */
export interface Flight {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  /** It came out of a circle (its day is in the month on screen); else it rises from below. */
  circle: boolean;
}
