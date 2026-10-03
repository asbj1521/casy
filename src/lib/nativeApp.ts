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
 * Fit the page to the app's screen; called once before the first render.
 *
 * The app draws the page edge to edge, under the clock and the home
 * indicator. `viewport-fit=cover` makes iOS report those areas to CSS as
 * env(safe-area-inset-*), which `html.native-app` in index.css pads the page
 * by. `maximum-scale=1` stops iOS zooming in on a text field smaller than
 * 16px when it's tapped: the app can't be pinched (Capacitor turns zoom off,
 * as native apps don't zoom), so the page stayed zoomed in after signing in.
 * Neither belongs on the website, where pinching must keep working.
 */
export function fitToApp() {
  if (!isNativeApp) return;
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover",
    );
  document.documentElement.classList.add("native-app");
}
