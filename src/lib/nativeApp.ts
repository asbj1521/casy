/**
 * The few things that differ when Casy runs as the iPhone app (Capacitor,
 * see capacitor.config.ts) rather than as the website. Everything here is a
 * no-op in a browser, so the website never changes because of the app.
 */

/**
 * True inside the iPhone app, false on the website. Read from the bridge the
 * app injects before the page runs (`window.Capacitor`) rather than through
 * @capacitor/core, which would add 3 kB to every website visitor's first load.
 */
export const isNativeApp =
  (
    window as { Capacitor?: { isNativePlatform?: () => boolean } }
  ).Capacitor?.isNativePlatform?.() === true;

/**
 * Mark the page as the app's; called once before the first render. The app
 * draws the page edge to edge, and `html.native-app` in index.css pads it by
 * the safe areas the viewport tag reports (see viewport.ts, which also stops
 * iOS zooming into small text fields, in the app and on the website alike).
 */
export function fitToApp() {
  if (!isNativeApp) return;
  document.documentElement.classList.add("native-app");
}
