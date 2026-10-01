/**
 * Text people typed, made safe to store and show: names of groups, events,
 * calendars and people.
 */

/** Control characters: newlines, tabs, NUL, DEL and the like. */
const CONTROL_CHARS = /\p{Cc}/gu;

export function stripControlChars(text: string): string {
  return text.replace(CONTROL_CHARS, "");
}

/**
 * Typed text as it should be stored, or null if nothing is left once the
 * control characters and surrounding spaces are gone. Trimmed again after the
 * length cap, so a name cut mid-space doesn't end in one.
 */
export function cleanText(raw: unknown, maxLength: number): string | null {
  if (typeof raw !== "string") return null;
  const text = stripControlChars(raw).trim().slice(0, maxLength).trim();
  return text.length > 0 ? text : null;
}
