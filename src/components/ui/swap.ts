/** Two views of one sheet swapping: a short fade and lift (Planlæg, New group). */
export const SWAP = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.22, ease: "easeOut" },
} as const;
