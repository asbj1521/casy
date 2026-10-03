import { isNativeApp } from "@/lib/nativeApp";

interface Shared {
  title: string;
  text: string;
  url: string;
}

/**
 * Hand a link to the phone's share sheet. True if the sheet opened (whether
 * or not something was then shared); false where there is none, so the
 * caller can show the link to copy by hand instead.
 *
 * In the app, Capacitor's own plugin, which always opens iOS's share sheet;
 * loaded only there, so the website never downloads it. In a browser, the
 * Web Share API, which phone browsers offer on https pages only (not on the
 * http:// address of a dev server).
 */
export async function shareLink(shared: Shared): Promise<boolean> {
  try {
    if (isNativeApp) {
      const { Share } = await import("@capacitor/share");
      await Share.share(shared);
      return true;
    }
    if (typeof navigator.share !== "function") return false;
    await navigator.share(shared);
    return true;
  } catch (error) {
    // Closing the sheet without sharing rejects too; it still opened.
    return isCancel(error);
  }
}

function isCancel(error: unknown): boolean {
  if (error instanceof DOMException) return error.name === "AbortError";
  return error instanceof Error && /cancel/i.test(error.message);
}
