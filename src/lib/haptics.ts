import { isNativeApp } from "@/lib/nativeApp";

/**
 * A small physical "click" under the thumb (#74), for the moments a swipe
 * means something:
 *
 * - `tick`: a dragged card crosses the line where letting go answers it.
 * - `answer`: a date has been answered.
 * - `success`: the answer that settled the event's date.
 * - `thud`: something heavy hitting (#126): a calendar landing on the pile,
 *   the pile pressed flat.
 * - `select`: a choice clicking into place (#173): a wheel's value passing
 *   its middle, a day or month tapped, a stepper pressed. iOS's selection
 *   feel, finer than a tick.
 *
 * In the app, iOS's own haptics through Capacitor's plugin, loaded only
 * there so the website never downloads it. On the website, the Vibration API
 * where the browser has one (Android); iPhone Safari has none, so there it
 * does nothing. Never throws: a missing buzz is not worth an error.
 */
type Haptic = "tick" | "answer" | "success" | "thud" | "select";

// iOS's selection generator only clicks once started; started once, it stays.
let selecting: Promise<void> | null = null;

export function haptic(kind: Haptic): void {
  if (isNativeApp) {
    void import("@capacitor/haptics")
      .then(({ Haptics, ImpactStyle, NotificationType }) =>
        kind === "select"
          ? (selecting ??= Haptics.selectionStart()).then(() => Haptics.selectionChanged())
          : kind === "success"
            ? Haptics.notification({ type: NotificationType.Success })
            : Haptics.impact({
                style:
                  kind === "tick"
                    ? ImpactStyle.Light
                    : kind === "thud"
                      ? ImpactStyle.Heavy
                      : ImpactStyle.Medium,
              }),
      )
      .catch(() => {});
    return;
  }
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(
      kind === "select"
        ? 4
        : kind === "tick"
          ? 8
          : kind === "answer"
            ? 15
            : kind === "thud"
              ? 28
              : [20, 60, 30],
    );
  } catch {
    // Some browsers refuse until the page has been tapped.
  }
}
