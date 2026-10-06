/**
 * Calendar colours (`"r, g, b"`, from calendarColors) as Apple Calendar
 * draws events in them (#74): a pale tint to fill with, and the colour
 * darkened for the words on it.
 */

/** The colour darkened, for a block's words on its own tint. */
export function shade(rgb: string, k = 0.72): string {
  return rgb
    .split(",")
    .map((c) => Math.round(Number(c) * k))
    .join(", ");
}

/**
 * A pale tint of the colour, solid rather than see-through, so a block
 * drawn over another reads cleanly on top of it.
 */
export function tint(rgb: string, amount = 0.16): string {
  return rgb
    .split(",")
    .map((c) => Math.round(255 - (255 - Number(c)) * amount))
    .join(", ");
}
