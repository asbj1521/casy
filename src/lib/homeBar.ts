import { useSyncExternalStore } from "react";

/**
 * Whether Planlæg's sent dates are flying (#169): the home page's buttons are
 * hidden while the plan is open, and come back for the flight, so the dates
 * have the Aftaler button to land in. Set by the pile, read by the home page.
 */
let flying = false;
const listeners = new Set<() => void>();

export function showHomeBarForFlight(on: boolean) {
  if (flying === on) return;
  flying = on;
  listeners.forEach((listener) => listener());
}

export function useHomeBarFlight(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => flying,
  );
}
