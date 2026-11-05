import { isNativeApp } from "@/lib/nativeApp";

/** iOS's body text at its default text size, which is Casy's 16px root. */
const IOS_DEFAULT_BODY_PX = 17;
const ROOT_PX = 16;
/**
 * How far it follows. Past this (iOS's accessibility sizes reach three times
 * the default) the phone's seven-column month has no room left: what a
 * person with those sizes gets is the largest that still lays out. Never
 * below the page as drawn: a smaller text size on the iPhone shrank Casy's
 * buttons along with its text, and the page as drawn is the standard.
 */
const MAX_SCALE = 1.35;
/** From this root size on, rows drop their icons so their words fit (`large-text:`). */
const LARGE_TEXT_PX = 18.5;

/** The page's root size for iOS's body text at `bodyPx`; everything in rem follows it. */
export function rootPxFor(bodyPx: number): number {
  const scale = Math.min(MAX_SCALE, Math.max(1, bodyPx / IOS_DEFAULT_BODY_PX));
  return Math.round(ROOT_PX * scale * 100) / 100;
}

/** What iOS's text size setting makes body text now: WebKit's own `-apple-system-body`. */
function iosBodyPx(): number | null {
  if (!CSS.supports("font", "-apple-system-body")) return null;
  const probe = document.createElement("span");
  probe.style.font = "-apple-system-body";
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.documentElement.append(probe);
  const px = parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  return Number.isFinite(px) && px > 0 ? px : null;
}

function apply() {
  const px = iosBodyPx();
  if (px === null) return;
  const root = rootPxFor(px);
  // At the default the page stays exactly as drawn, with no size of its own.
  document.documentElement.style.fontSize = root === ROOT_PX ? "" : `${root}px`;
  document.documentElement.classList.toggle("large-text", root >= LARGE_TEXT_PX);
}

/**
 * Casy follows the iPhone's text size in the app (#216): read before the first
 * paint, and again on coming back, since that is where the setting is changed.
 * The website and computers keep the browser's own size.
 */
export function followTextSize() {
  if (!isNativeApp) return;
  apply();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") apply();
  });
}
