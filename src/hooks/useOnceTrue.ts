import { useState } from "react";

/**
 * Whether `value` has ever been true while this component has been mounted:
 * a sheet loaded on demand is fetched the first time it opens and then stays
 * mounted, so it can slide away when closed (#157).
 */
export function useOnceTrue(value: boolean): boolean {
  const [seen, setSeen] = useState(value);
  // Adjusted while rendering (React's way to follow a prop), so the sheet is
  // asked for on the very render that opens it.
  if (value && !seen) setSeen(true);
  return seen;
}
