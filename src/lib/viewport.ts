/**
 * The page's viewport tag, set once before the first render (main.tsx).
 *
 * iOS zooms in on any text field smaller than 16px when it's tapped, and
 * leaves the page zoomed: signing in on the website (14px fields) used to
 * open the scheduler zoomed in, to be pinched back by hand (#96).
 * `maximum-scale=1` stops that zoom. On an iPhone or iPad it costs nothing,
 * since Safari has let people pinch-zoom past it since iOS 10. Elsewhere it
 * would: Android honours it and blocks pinching, and Android never zooms on
 * a tap anyway, so it is left out there.
 *
 * Kept free of `window` and `nativeApp.ts` at load, so it can be tested in
 * Node; the caller says whether this is the app.
 */

/**
 * True on an iPhone, iPod or iPad, in any browser (they are all Safari's
 * engine underneath). An iPad asks for desktop sites and calls itself a Mac,
 * so only its touch screen gives it away.
 */
export function isAppleTouch(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

/**
 * What the viewport tag says. The app also draws edge to edge, under the
 * clock and the home indicator: `viewport-fit=cover` makes iOS report those
 * areas to CSS as env(safe-area-inset-*), which `html.native-app` in
 * index.css pads the page by. The app can't be pinched either way
 * (Capacitor turns zoom off, as native apps don't zoom).
 */
export function viewportContent({ app, appleTouch }: { app: boolean; appleTouch: boolean }) {
  const parts = ["width=device-width", "initial-scale=1.0"];
  if (app || appleTouch) parts.push("maximum-scale=1.0");
  if (app) parts.push("viewport-fit=cover");
  return parts.join(", ");
}

/** Write the tag for this device; `app` is `isNativeApp`. */
export function fitViewport(app: boolean) {
  const appleTouch = isAppleTouch(navigator.userAgent, navigator.maxTouchPoints);
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute("content", viewportContent({ app, appleTouch }));
}
