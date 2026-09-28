/**
 * What makes a password good enough for Casy, checked in the browser wherever
 * one is chosen (PasswordForm) and again after signing in with one (to nudge
 * people with an older, weaker password to pick a new one).
 *
 * The length and letters-and-numbers rules match what Supabase Auth enforces
 * on the server (`minimum_password_length` and `password_requirements =
 * "letters_digits"` in supabase/config.toml), so the form never approves a
 * password the server would refuse. The server can't know a person's name,
 * and the leak check needs a service Supabase only offers on paid plans, so
 * those two live here.
 */

/** Matches `minimum_password_length` in supabase/config.toml. */
export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordChecks {
  length: boolean;
  /** At least one a-z letter and one digit: Supabase's "letters_digits". */
  lettersAndDigits: boolean;
  /** Doesn't contain the person's email name or name. */
  notPersonal: boolean;
}

/** Lowercase, and only letters and digits, so "Anna.Jensen" and "annajensen" compare equal. */
function squash(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * The parts of an email address or name worth refusing in a password: the
 * whole thing, the part before the @, and each word. Short bits ("bo", "a")
 * are skipped, since refusing every password containing them would refuse
 * far too much.
 */
export function personalWords(values: (string | null | undefined)[]): string[] {
  const words = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    const local = value.split("@")[0];
    for (const part of [value, local, ...local.split(/[\s._+-]+/)]) {
      const squashed = squash(part);
      if (squashed.length >= 4) words.add(squashed);
    }
  }
  return [...words];
}

export function checkPassword(password: string, personal: string[]): PasswordChecks {
  const squashed = squash(password);
  return {
    length: password.length >= MIN_PASSWORD_LENGTH,
    lettersAndDigits: /[A-Za-z]/.test(password) && /[0-9]/.test(password),
    notPersonal: !personal.some((word) => squashed.includes(word)),
  };
}

export function passesChecks(checks: PasswordChecks): boolean {
  return checks.length && checks.lettersAndDigits && checks.notPersonal;
}

/** Uppercase hex SHA-1, as Have I Been Pwned lists them. */
export async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * How often a hash suffix appears in a range answer ("SUFFIX:COUNT" per
 * line). Padding lines carry a count of 0, so they never match as a leak.
 */
export function breachCount(rangeAnswer: string, suffix: string): number {
  for (const line of rangeAnswer.split(/\r?\n/)) {
    const [candidate, count] = line.trim().split(":");
    if (candidate?.toUpperCase() === suffix) return Number.parseInt(count, 10) || 0;
  }
  return 0;
}

const RANGE_URL = "https://api.pwnedpasswords.com/range/";
const LEAK_CHECK_TIMEOUT_MS = 4000;

/**
 * How many times this password appears in known data leaks, from Have I Been
 * Pwned. Only the first 5 characters of its SHA-1 hash leave the browser; the
 * service answers with every leaked hash starting with them (padded with
 * decoys, so even the answer's size says nothing) and the match happens here.
 * The password itself is never sent anywhere. Null if the service couldn't be
 * reached: the other rules still apply, so a slow network never blocks anyone.
 */
export async function timesLeaked(password: string, fetchImpl: typeof fetch = fetch): Promise<number | null> {
  try {
    const hash = await sha1Hex(password);
    const res = await fetchImpl(RANGE_URL + hash.slice(0, 5), {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(LEAK_CHECK_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return breachCount(await res.text(), hash.slice(5));
  } catch {
    return null;
  }
}
