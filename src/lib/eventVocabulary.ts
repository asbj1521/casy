/**
 * The words Casy's AI uses to describe events, shared by the labels on your
 * own events (#112) and the profile of an event being planned (#113), so the
 * warnings (#114) can set one against the other: a label says what an event
 * is sensitive to the day before, a profile says which of those things the
 * planned event causes.
 *
 * The same lists as supabase/functions/_shared/eventVocabulary.ts; a test
 * (eventVocabulary.test.ts) fails if they drift apart.
 */

/** What an event can cause, and what another can't stand the day before it. */
export const EFFECTS = ["lateNight", "alcohol", "travel", "exercise"] as const;
export type Effect = (typeof EFFECTS)[number];

/** How tiring an event is. */
export const STRAIN = ["none", "light", "moderate", "heavy"] as const;
export type Strain = (typeof STRAIN)[number];

/** How sure the AI is: low whenever it is guessing. */
export const CONFIDENCE = ["low", "medium", "high"] as const;
export type Confidence = (typeof CONFIDENCE)[number];

/** Days after an event someone may need to recover. */
export const MAX_RECOVERY_DAYS = 3;
