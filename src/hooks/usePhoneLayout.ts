import { useSyncExternalStore } from "react";

/**
 * Below Tailwind's `md` (768px) Casy uses its phone layout: the tab bar along
 * the bottom (TabBar), a compact header (PhoneHeader), and screens split up
 * to fit. Computers and tablets keep the layout they have always had. Keep in
 * step with --tab-bar-height in index.css.
 */
const PHONE_QUERY = "(max-width: 767.98px)";

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const matchesPhone = () =>
  typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches;

/**
 * True on a phone-sized screen, and updated when the window is resized. Read
 * in JavaScript rather than hidden with CSS where a layout differs, so the
 * other layout isn't rendered at all: on a computer, the page is exactly what
 * it was before the phone layout existed.
 */
export function usePhoneLayout(): boolean {
  return useSyncExternalStore(subscribe, matchesPhone, () => false);
}
