/**
 * How the calendar strip under a swipe card zooms into the whole screen and
 * back (#74): iOS's own easing, a little quicker going back.
 *
 * It is a zoom, not a morph of the box: the whole calendar is scaled down
 * evenly to the strip's width and clipped to its shape, then grows to the
 * screen (CalendarSheet). A morph that resizes the box scales its contents
 * unevenly, which stretched the text, and hiding them meanwhile left them to
 * pop in afterwards; scaled evenly, they can be shown the whole way.
 */
export const ZOOM = { inMs: 380, outMs: 320, easing: "cubic-bezier(0.32, 0.72, 0, 1)" } as const;
