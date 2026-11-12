/**
 * Which browser the page is in, where the invite page needs to know (#257):
 * an iPhone's (where the app can be got, or opened), and a chat app's own on
 * one (which hands no link on to the Casy app). Read once: neither changes.
 */
import { inAppBrowser } from "@/lib/appLinks";
import { isNativeApp } from "@/lib/nativeApp";

/** An iPhone's browser, Safari or another; not an iPad, since the app is iPhone only. */
export const onIPhoneBrowser = !isNativeApp && /iPhone/.test(navigator.userAgent);

/** A chat app's own browser on an iPhone (Messenger, Instagram and the like). */
export const insideChatBrowser = onIPhoneBrowser && inAppBrowser(navigator.userAgent);
