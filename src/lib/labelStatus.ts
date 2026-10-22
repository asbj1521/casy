import { useSyncExternalStore } from "react";

/**
 * Why event labelling (#112) is or isn't running, as one technical line for
 * admins and AI testers in Your data (the app only): which condition holds
 * and which doesn't, how many titles wait, and how the last run went. Not
 * copy for visitors, so it is not translated, like the build line on the
 * profile. Kept in memory only, rewritten at every step of useAutoLabel.
 */
let status = "not started";
const listeners = new Set<() => void>();

export function setLabelStatus(next: string): void {
  if (next === status) return;
  status = next;
  for (const listener of listeners) listener();
}

export function useLabelStatus(): string {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => status,
  );
}
