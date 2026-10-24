import type { CalendarConnectionStatus } from "@/api/calendars";
import type { Group, Invitation, WhoAmI } from "@/api/groups";
import { callFunction } from "@/lib/supabaseFunctions";

/** What the groups function's `start` action answers: a page's first questions in one (#158). */
interface Start {
  whoami: WhoAmI;
  groups: Group[];
  invitations: Invitation[];
  connections: CalendarConnectionStatus[];
  pulse: string;
}

/** Only questions asked this soon after `start` share it: a later one would get an old answer. */
const SHARED_FOR_MS = 10_000;

let start: {
  userId: string;
  answer: Promise<Start>;
  taken: Set<keyof Start>;
  madeAt: number;
} | null = null;

/**
 * A page's first fetch of each of its opening questions (who you are, your
 * groups, your invitations, your calendar accounts, the live pulse) shares one `start` call (#158);
 * every later fetch asks on its own, as before. A server without `start`
 * (not deployed yet) answers an error, and each question then asks itself.
 */
export function firstFromStart<K extends keyof Start>(
  userId: string,
  key: K,
  own: () => Promise<Start[K]>,
): Promise<Start[K]> {
  if (!start || start.userId !== userId) {
    start = {
      userId,
      answer: callFunction<Start>("groups", { body: { action: "start" } }),
      taken: new Set(),
      madeAt: Date.now(),
    };
  }
  if (start.taken.has(key) || Date.now() - start.madeAt > SHARED_FOR_MS) return own();
  start.taken.add(key);
  return start.answer.then(
    (answer) => (answer[key] === undefined ? own() : answer[key]),
    () => own(),
  );
}
