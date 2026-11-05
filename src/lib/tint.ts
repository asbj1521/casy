/**
 * Calendar colours (`"r, g, b"`, from calendarColors) as Apple Calendar
 * draws events in them (#74): a tint to fill with, and the colour adjusted
 * for the words on it. In light mode a pale tint with darkened words; in dark
 * mode (#93), as Apple does there, a deep tint with the colour itself for words.
 */

/** How much of the colour a dark tint holds, over black: Apple's own, measured (#220). */
const DARK_TINT = 0.3;
/** What the words on a dark tint must reach: 4.5:1, the same as other small text. */
const MIN_CONTRAST = 4.5;

const channels = (rgb: string) => rgb.split(",").map((c) => Number(c));

function luminance(rgb: number[]): number {
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const darkTint = (rgb: number[]) => rgb.map((c) => Math.round(c * DARK_TINT));

/**
 * The colour for a block's words on its own tint. In dark mode the colour
 * itself, as Apple draws it, so it stays vivid; one too dark to read on its
 * tint is lifted towards white only as far as it takes.
 */
export function shade(rgb: string, dark = false): string {
  const color = channels(rgb);
  if (!dark) return color.map((c) => Math.round(c * 0.72)).join(", ");
  const ground = darkTint(color);
  let words = color;
  for (let lift = 0.05; contrast(words, ground) < MIN_CONTRAST && lift <= 1; lift += 0.05) {
    words = color.map((c) => Math.round(c + (255 - c) * lift));
  }
  return words.join(", ");
}

/**
 * The tint of the colour, solid rather than see-through, so a block drawn
 * over another reads cleanly on top of it. In dark mode the colour darkened
 * over black: mixed into a grey it went muddy (#220).
 */
export function tint(rgb: string, dark = false): string {
  const color = channels(rgb);
  return (dark ? darkTint(color) : color.map((c) => Math.round(255 - (255 - c) * 0.16))).join(", ");
}
