/**
 * How the calendar strip under a swipe card grows into the whole screen and
 * back (#74): the one spring CalendarStrip and CalendarSheet share, so both
 * ends of the morph move alike.
 */
export const MORPH = { type: "spring", damping: 34, stiffness: 340, mass: 0.9 } as const;
