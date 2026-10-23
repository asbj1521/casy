import { useState } from "react";

/**
 * A number that goes up each time `open` turns true. Used as the key of a
 * sheet's inner part, so its state starts fresh on every opening while the
 * same instance stays mounted through the closing animation.
 */
export function useOpenRound(open: boolean): number {
  const [round, setRound] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  // Adjusted while rendering (React's way to follow a prop), not in an effect,
  // so the fresh state is there on the first frame of the opening.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setRound(round + 1);
  }
  return round;
}
