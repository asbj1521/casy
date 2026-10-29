/**
 * iOS's own push, for a sheet whose rows open screens inside it (#174, #177):
 * the new screen in from the right, the old one a little left. The sheet is
 * glass, with nothing behind a screen to hide the one it covers, so the one
 * going under fades out on its way. `dir` is 1 going deeper, -1 back.
 */
export const PUSH = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-30%", opacity: dir > 0 ? 1 : 0 }),
  center: { x: "0%", opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? "-30%" : "100%", opacity: dir > 0 ? 0 : 1 }),
};

/** The push's pace: iOS's easing, nothing under reduced motion. */
export function pushTransition(reduce: boolean | null) {
  return { duration: reduce ? 0 : 0.34, ease: [0.32, 0.72, 0, 1] as const };
}
