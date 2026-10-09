import { useSyncExternalStore } from "react";

import { isDarkNow, onThemeChange } from "@/lib/theme";

/**
 * Whether the page is drawn dark right now (#93), for the few colours worked
 * out in code rather than CSS (calendar blocks, lib/tint.ts). Follows the
 * phone or computer switching while the page is open, and the profile's
 * choice.
 */
export function useIsDark(): boolean {
  return useSyncExternalStore(onThemeChange, isDarkNow, () => false);
}
