/**
 * Browser storage that never throws. Storage can be blocked (private windows,
 * strict privacy settings), and then even touching it throws. Everything the
 * app keeps there is a convenience, so blocked storage simply reads as empty
 * and forgets what it is told.
 */

type Area = "local" | "session";

const area = (kind: Area): Storage => (kind === "session" ? sessionStorage : localStorage);

export function readStored(key: string, kind: Area = "local"): string | null {
  try {
    return area(kind).getItem(key);
  } catch {
    return null;
  }
}

/** Remember `value` under `key`; null forgets it. */
export function writeStored(key: string, value: string | null, kind: Area = "local"): void {
  try {
    if (value === null) area(kind).removeItem(key);
    else area(kind).setItem(key, value);
  } catch {
    // Not remembered; nothing depends on it.
  }
}
