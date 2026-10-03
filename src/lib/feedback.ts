/**
 * "Send feedback" on the phone profile: an email to the person behind Casy,
 * with what's needed to follow up on a bug already filled in below the space
 * for the message.
 */

/** Where feedback goes. Shown to anyone who taps the row. */
export const FEEDBACK_EMAIL = "asbjornbay@gmail.com";

/** Which code this build was made from (vite.config.ts), "dev" without one. */
export const APP_BUILD: string = import.meta.env.VITE_APP_BUILD ?? "dev";

/** A mailto: link with the subject set and the build and device at the bottom. */
export function feedbackMailto({
  subject,
  prompt,
  build,
  platform,
  userAgent,
}: {
  subject: string;
  /** The first line, above the space left for the message. */
  prompt: string;
  build: string;
  /** "app" or "web". */
  platform: string;
  userAgent: string;
}): string {
  const body = `${prompt}\n\n\n\n---\nCasy ${build} (${platform})\n${userAgent}`;
  // encodeURIComponent rather than URLSearchParams: mail apps read "+" as a
  // plus sign, not a space.
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
