/**
 * How the calendar strip under a swipe card grows into the whole screen and
 * back (#74), shared by CalendarStrip and CalendarSheet so both ends move
 * alike: iOS's own easing, over a fixed time, so the contents can wait it out.
 *
 * Only the empty box morphs. Framer Motion morphs by scaling, which would
 * stretch the text inside along with it, so the contents are hidden while
 * the box changes size and fade in once it has its final one (CONTENT_IN).
 */
export const MORPH = { duration: 0.34, ease: [0.32, 0.72, 0, 1] } as const;

/** The contents fading in once the box has finished its morph. */
export const CONTENT_IN = { delay: MORPH.duration, duration: 0.16 } as const;

/** The contents fading out before the box morphs back. */
export const CONTENT_OUT_MS = 110;
