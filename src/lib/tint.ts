/**
 * Calendar colours (`"r, g, b"`, from calendarColors) as Apple Calendar
 * draws events in them (#74): a tint to fill with, and the colour adjusted
 * for the words on it. In light mode a pale tint with darkened words; in dark
 * mode (#93), as Apple does there, a deep tint with brightened words.
 */

/** The dark card (--card in theme.css) a dark tint is mixed into. */
const DARK_BASE = [27, 27, 29];

const channels = (rgb: string) => rgb.split(",").map((c) => Number(c));

/** The colour for a block's words on its own tint. */
export function shade(rgb: string, dark = false): string {
  return channels(rgb)
    .map((c) => Math.round(dark ? c + (255 - c) * 0.45 : c * 0.72))
    .join(", ");
}

/**
 * The tint of the colour, solid rather than see-through, so a block drawn
 * over another reads cleanly on top of it.
 */
export function tint(rgb: string, dark = false): string {
  return channels(rgb)
    .map((c, i) =>
      Math.round(dark ? DARK_BASE[i] + (c - DARK_BASE[i]) * 0.3 : 255 - (255 - c) * 0.16),
    )
    .join(", ");
}
