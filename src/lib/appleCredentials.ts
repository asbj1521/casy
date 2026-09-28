/**
 * Apple's app-specific passwords, as far as the browser needs to know.
 *
 * Apple shows every app-specific password as 16 letters in four groups, like
 * abcd-efgh-ijkl-mnop. The server accepts whatever is typed and lets Apple
 * decide (calendar-add-apple); this exists so a form can warn before that
 * round trip that what was pasted looks like something else, which is almost
 * always the person's normal Apple password.
 *
 * It is advice, never a block: if Apple ever changes the format, the worst
 * case is a warning nobody needed. So it errs lenient (either case, with or
 * without the dashes) rather than warn about a password that would work.
 */

const GROUPED = /^[a-z]{4}-[a-z]{4}-[a-z]{4}-[a-z]{4}$/i;
const UNGROUPED = /^[a-z]{16}$/i;

/** True if `value` has the shape of an app-specific password. Surrounding spaces are ignored, as the server trims them. */
export function looksLikeAppSpecificPassword(value: string): boolean {
  const trimmed = value.trim();
  return GROUPED.test(trimmed) || UNGROUPED.test(trimmed);
}
