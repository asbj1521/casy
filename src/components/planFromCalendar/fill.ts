import type { FillKey } from "./useAiFill";

export type { FillKey };

/**
 * A row's light while Casy fills it in (#173): soft orange while it is the
 * one, fading out as the next one takes over.
 */
export function litClass(lit: FillKey | null, key: FillKey): string {
  return lit === key
    ? "bg-primary/15 transition-colors duration-150"
    : "transition-colors duration-700";
}

/** The same light as a ring, for a box with a background of its own. */
export function litRing(lit: FillKey | null, key: FillKey): string {
  return lit === key
    ? "ring-2 ring-primary/50 transition-shadow duration-150"
    : "ring-0 ring-primary/0 transition-shadow duration-700";
}
